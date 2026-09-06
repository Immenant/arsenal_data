import { readdir, rename, rm, unlink } from "node:fs/promises";
import * as path from "node:path";
import { parseClassnameData, serializeClassnameData } from "./classname_data.ts";

interface MigrationEntry {
  sourcePath: string;
  targetPath: string;
  classnames: string[];
  csvText: string;
}

export interface MigrationResult {
  files: number;
  classnames: number;
}

async function findJsonFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findJsonFiles(entryPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      files.push(entryPath);
    }
  }

  return files;
}

async function prepareMigration(roots: readonly string[]): Promise<MigrationEntry[]> {
  const sourcePaths = (await Promise.all(roots.map(findJsonFiles))).flat().sort();
  const migration: MigrationEntry[] = [];

  for (const sourcePath of sourcePaths) {
    const targetPath = `${sourcePath.slice(0, -path.extname(sourcePath).length)}.csv`;
    if (await Bun.file(targetPath).exists()) {
      throw new Error(`Migration target already exists: ${targetPath}`);
    }

    const sourceText = await Bun.file(sourcePath).text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(sourceText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${sourcePath}: invalid JSON: ${message}`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error(`${sourcePath}: expected a JSON array`);
    }
    if (!parsed.every((value) => typeof value === "string")) {
      throw new Error(`${sourcePath}: every JSON array value must be a string`);
    }

    const classnames = parsed;
    const csvText = serializeClassnameData(classnames, sourcePath);
    migration.push({ sourcePath, targetPath, classnames, csvText });
  }

  return migration;
}

export async function migrateArsenalData(roots: readonly string[]): Promise<MigrationResult> {
  const migration = await prepareMigration(roots);

  for (const entry of migration) {
    const temporaryPath = `${entry.targetPath}.tmp`;
    try {
      await Bun.write(temporaryPath, entry.csvText);
      const converted = parseClassnameData(await Bun.file(temporaryPath).text(), temporaryPath);
      if (converted.length !== entry.classnames.length || converted.some((value, index) => value !== entry.classnames[index])) {
        throw new Error(`Converted data does not match source: ${entry.sourcePath}`);
      }
      await rename(temporaryPath, entry.targetPath);
      await unlink(entry.sourcePath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  return {
    files: migration.length,
    classnames: migration.reduce((total, entry) => total + entry.classnames.length, 0)
  };
}

if (import.meta.main) {
  const repoRoot = path.resolve(import.meta.dir, "..");
  const roots = [path.join(repoRoot, "data_arsenal"), path.join(repoRoot, "archive_arsenal")];
  const result = await migrateArsenalData(roots);
  console.log(`Migrated ${result.files} files containing ${result.classnames} classnames`);
}