import { readdir } from "node:fs/promises";
import * as path from "node:path";
import { isClassnameDataFile, parseClassnameData, serializeClassnameData } from "./classname_data.ts";

const repoRoot = path.resolve(import.meta.dir, "..");
const dataArsenalDir = path.join(repoRoot, "data_arsenal");

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function findDuplicates(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function sortAlphabetically(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

async function getClassnameFilesUnder(dir: string): Promise<string[]> {
  const result: string[] = [];

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const nestedEntries = await readdir(entryPath, { withFileTypes: true });
      for (const nestedEntry of nestedEntries) {
        if (!nestedEntry.isFile() || !isClassnameDataFile(nestedEntry.name)) continue;
        result.push(path.join(entryPath, nestedEntry.name));
      }
      continue;
    }

    if (entry.isFile() && isClassnameDataFile(entry.name)) {
      result.push(entryPath);
    }
  }

  return result;
}

async function processClassnameFile(filePath: string): Promise<{ changed: boolean } | { skipped: true } | { failed: true; reason: string }> {
  try {
    const exists = await Bun.file(filePath).exists();
    if (!exists) return { skipped: true };

    const originalText = await Bun.file(filePath).text();

    const classnames = parseClassnameData(originalText, filePath);
    const duplicates = findDuplicates(classnames);
    if (duplicates.length > 0) {
      console.warn(`[duplicates] ${filePath}: ${duplicates.length} duplicate values found`);
      for (const dup of duplicates) {
        console.warn(`  - ${dup}`);
      }
    }

    const uniqueSorted = sortAlphabetically(Array.from(new Set(classnames)));
    const nextText = serializeClassnameData(uniqueSorted, filePath);

    if (nextText === originalText) {
      return { changed: false };
    }

    await Bun.write(filePath, nextText);
    return { changed: true };
  } catch (error) {
    return { failed: true, reason: formatError(error) };
  }
}

if (import.meta.main) {
  const started = Date.now();

  let processed = 0;
  let changed = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const classnameFiles = await getClassnameFilesUnder(dataArsenalDir);
    for (const filePath of classnameFiles) {
      const result = await processClassnameFile(filePath);

      if ("skipped" in result) {
        skipped++;
        continue;
      }

      if ("failed" in result) {
        failed++;
        console.error(`[failed] ${filePath}: ${result.reason}`);
        continue;
      }

      processed++;
      if (result.changed) changed++;
    }
  } catch (error) {
    console.error(`Failed to scan ${dataArsenalDir}: ${formatError(error)}`);
    process.exit(1);
  }

  const durationMs = Date.now() - started;
  console.log(`Processed ${processed} files (${changed} updated, ${skipped} skipped, ${failed} failed) in ${durationMs}ms`);
  if (failed > 0) process.exitCode = 1;
}