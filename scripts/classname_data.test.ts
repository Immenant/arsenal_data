import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { isClassnameDataFile, parseClassnameData, serializeClassnameData } from "./classname_data.ts";
import { migrateArsenalData } from "./migrate_arsenal_data.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("classname data", () => {
  test("parses LF, CRLF, a BOM, and an optional final newline", () => {
    expect(parseClassnameData("Alpha\nBravo")).toEqual(["Alpha", "Bravo"]);
    expect(parseClassnameData("Alpha\r\nBravo\r\n")).toEqual(["Alpha", "Bravo"]);
    expect(parseClassnameData("\uFEFFAlpha\n")).toEqual(["Alpha"]);
  });

  test("serializes one classname per line without a final newline", () => {
    expect(serializeClassnameData(["Alpha", "Bravo"])).toBe("Alpha\nBravo");
  });

  test.each([
    ["blank rows", "Alpha\n\nBravo"],
    ["surrounding whitespace", " Alpha"],
    ["commas", "Alpha,Bravo"],
    ["quotes", '"Alpha"'],
    ["standalone carriage returns", "Alpha\rBravo"]
  ])("rejects %s", (_description, input) => {
    expect(() => parseClassnameData(input)).toThrow();
  });

  test("matches only exact CSV extensions", () => {
    expect(isClassnameDataFile("items.csv")).toBe(true);
    expect(isClassnameDataFile("items.CSV")).toBe(true);
    expect(isClassnameDataFile("items.csv.bak")).toBe(false);
    expect(isClassnameDataFile("items.json")).toBe(false);
  });
});

describe("arsenal data migration", () => {
  test("preserves classname order and removes JSON sources after verification", async () => {
    const root = await createTemporaryRoot();
    const unitDir = path.join(root, "unit");
    await mkdir(unitDir);
    await Bun.write(path.join(unitDir, "items.json"), JSON.stringify(["Bravo", "Alpha"]));

    const result = await migrateArsenalData([root]);

    expect(result).toEqual({ files: 1, classnames: 2 });
    expect(await Bun.file(path.join(unitDir, "items.csv")).text()).toBe("Bravo\nAlpha");
    expect(await Bun.file(path.join(unitDir, "items.json")).exists()).toBe(false);
  });

  test("preflights every source before writing any target", async () => {
    const root = await createTemporaryRoot();
    await Bun.write(path.join(root, "valid.json"), JSON.stringify(["Alpha"]));
    await Bun.write(path.join(root, "invalid.json"), JSON.stringify([42]));

    let migrationError: unknown;
    try {
      await migrateArsenalData([root]);
    } catch (error) {
      migrationError = error;
    }

    expect(String(migrationError)).toContain("every JSON array value must be a string");
    expect(await Bun.file(path.join(root, "valid.json")).exists()).toBe(true);
    expect(await Bun.file(path.join(root, "valid.csv")).exists()).toBe(false);
  });
});

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "arsenal-migration-"));
  temporaryDirectories.push(root);
  return root;
}