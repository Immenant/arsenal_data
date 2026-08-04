import { mkdir, readdir, stat } from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";

const repoRoot = path.resolve(import.meta.dir, "..");

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadAndCombineData(dataFolder: string): Promise<string[]> {
  const combinedData: string[] = [];

  const jsonFiles = await readdir(dataFolder);
  for (const entry of jsonFiles) {
    if (!entry.includes(".json")) continue;
    const filePath = path.join(dataFolder, entry);
    const fileExists = await Bun.file(filePath).exists();
    if (!fileExists) continue;
    const fileContent = await Bun.file(filePath).text();

    try {
      const jsonData = JSON.parse(fileContent);
      if (Array.isArray(jsonData)) {
        combinedData.push(...jsonData.map(String)); // Ensure items are strings
      } else {
        console.error(`Invalid JSON format in file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error parsing JSON in file: ${filePath}`);
      console.error(error);
    }
  }

  return combinedData;
}

function removeDuplicates(data: string[]): string[] {
  return Array.from(new Set(data));
}

function findDuplicates(data: string[]): string[] {
  const seen: { [key: string]: boolean } = {};
  const duplicates: string[] = [];

  for (const item of data) {
    if (seen[item]) {
      duplicates.push(item);
    } else {
      seen[item] = true;
    }
  }

  return duplicates;
}

function printDuplicates(data: string[]): void {
  const duplicates = findDuplicates(data);

  if (duplicates.length > 0) {
    console.log("\nDuplicate items found:");
    duplicates.forEach((item) => {
      console.log(item);
    });
  } else {
    console.log("No duplicates found.");
  }
}

function sortData(data: string[]): string[] {
  return data.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _compareWithFile(data: string[], compareFilePath: string): Promise<void> {
  try {
    const compareFileContent = await Bun.file(compareFilePath).text();
    const compareData = (await JSON.parse(compareFileContent)) as string[];

    const missingItems = compareData.filter((item: string) => !data.some((dataItem: string) => dataItem.toLowerCase() === item.toLowerCase()));

    if (missingItems.length > 0) {
      console.log("\nStrings missing from combined data:");
      missingItems.forEach((item: string) => {
        console.log(item);
      });
    } else {
      console.log("No missing strings found.");
    }
  } catch (error) {
    console.error(`Error reading or parsing compare file: ${compareFilePath}`);
    console.error(error);
  }
}

async function writeToFile(data: string[], prefix: string): Promise<void> {
  const distFolder = path.join(repoRoot, "output");
  const currentDate = new Date();
  const formattedDate = currentDate.toISOString().split("T")[0];

  // const fileName = `${prefix}_${formattedDate}`;
  const fileName = `arsenal_${prefix}`;

  try {
    await mkdir(distFolder, { recursive: true });
  } catch (error) {
    console.error(`Error creating ${distFolder} folder: ${formatError(error)}`);
    process.exit(1);
  }

  // const jsonFile = join(distFolder, fileName + ".json");
  const sqfFileInit = path.join(distFolder, `init_${fileName}.sqf`);
  const sqfFileExec = path.join(distFolder, `${fileName}.sqf`);
  const jsonContent = JSON.stringify(data);

  const sqfContentInit = `"Type: ${prefix} | Last Updated: ${formattedDate}";
[this, false] call ace_dragging_fnc_setDraggable;
[this, false] call ace_dragging_fnc_setCarryable;
[this, -1] call ace_cargo_fnc_setSize;
this enableVehicleCargo false;
[this,
  ${jsonContent}
] call ace_arsenal_fnc_initBox;
`;

  const sqfContentExec = `"Type: ${prefix} | Last Updated: ${formattedDate}";
params ["_Arsenal"];
[_Arsenal, false] call ace_dragging_fnc_setDraggable;
[_Arsenal, false] call ace_dragging_fnc_setCarryable;
[_Arsenal, -1] call ace_cargo_fnc_setSize;
_Arsenal enableVehicleCargo false;
[_Arsenal,
  ${jsonContent}
] call ace_arsenal_fnc_initBox;`;

  try {
    console.log("\n");
    // await fs.writeFile(jsonFile, jsonContent, { encoding: "utf8" });
    // console.log(`Data written to file: ${jsonFile}`);

    await Bun.write(sqfFileInit, sqfContentInit);
    console.log(`Data written to file: ${sqfFileInit}`);

    await Bun.write(sqfFileExec, sqfContentExec);
    console.log(`Data written to file: ${sqfFileExec}`);
    console.log("\n");
  } catch (error) {
    console.error(`Error writing to file: ${formatError(error)}`);
    process.exit(1);
  }
}

async function loadAllUnitsData(dataFolder: string): Promise<string[]> {
  const allData: string[] = [];

  const folders = await readdir(dataFolder);
  for (const folder of folders) {
    const folderPath = path.join(dataFolder, folder);
    const folderStat = await stat(folderPath);
    if (folderStat.isDirectory()) {
      const folderData = await loadAndCombineData(folderPath);
      allData.push(...folderData);
    }
  }

  return allData;
}

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    "no-check": {
      type: "boolean",
      default: false
    },
    unit: {
      type: "string",
      short: "u"
    },
    all: {
      type: "boolean",
      short: "a",
      default: false
    }
  },
  strict: true,
  allowPositionals: true
});

const dataPath = "data_arsenal";
const resolvedDataPath = path.join(repoRoot, dataPath);

if (values.all) {
  try {
    const folders = await readdir(resolvedDataPath);
    for (const folder of folders) {
      const folderPath = path.join(resolvedDataPath, folder);
      const folderStat = await stat(folderPath);
      if (folderStat.isDirectory()) {
        console.log(`\n=== Processing unit: ${folder} ===`);
        let data = await loadAndCombineData(folderPath);
        if (!values["no-check"]) {
          printDuplicates(data);
        }
        data = removeDuplicates(data);
        data = sortData(data);
        await writeToFile(data, folder);
      }
    }

    // Generate "all" preset combining all units
    console.log(`\n=== Processing all units combined ===`);
    let allData = await loadAllUnitsData(resolvedDataPath);
    allData = removeDuplicates(allData);
    allData = sortData(allData);
    await writeToFile(allData, "all");
  } catch (error) {
    console.error(`Error processing data_arsenal folders: ${formatError(error)}`);
    process.exit(1);
  }
} else if (values.unit) {
  const dataFolderPath = path.join(resolvedDataPath, values.unit);
  let data = await loadAndCombineData(dataFolderPath);
  if (!values["no-check"]) {
    printDuplicates(data);
  }
  data = removeDuplicates(data);
  data = sortData(data);
  await writeToFile(data, values.unit);
} else {
  throw new Error("Missing --unit (-u) argument specifying the unit folder under data_arsenal, or use --all (-a) to process all units");
}