import { mkdir, readdir, stat } from "node:fs/promises";
import * as path from "path";

async function getAllUnitLoadoutFiles(
	baseDir: string,
): Promise<{ unit: string; loadout: string; file: string }[]> {
	const result: { unit: string; loadout: string; file: string }[] = [];
	const units = await readdir(baseDir);
	for (const unit of units) {
		const unitPath = path.join(baseDir, unit);
		const unitStat = await stat(unitPath);
		if (!unitStat.isDirectory()) continue;
		const loadouts = await readdir(unitPath);
		for (const loadoutFile of loadouts) {
			if (!loadoutFile.endsWith(".json")) continue;
			const loadout = loadoutFile.replace(/\.json$/i, "");
			result.push({ unit, loadout, file: path.join(unitPath, loadoutFile) });
		}
	}
	return result;
}

const baseDir = "data_loadouts";
const outputFile = path.join("output", "loadouts.sqf");
const currentDate = new Date().toISOString().split("T")[0];
const outputLines: string[] = [];
outputLines.push(`"Last Updated: ${currentDate}";`);

try {
	const allLoadouts = await getAllUnitLoadoutFiles(baseDir);
	for (const { unit, loadout, file } of allLoadouts) {
		const name = `[${unit.replace(/_/g, " ")}] ${loadout.replace(/_/g, " ")}`;
		let loadoutArray = [];
		try {
			const content = await Bun.file(file).text();
			loadoutArray = JSON.parse(content);
			if (!Array.isArray(loadoutArray)) {
				console.error(`Invalid loadout array in ${file}`);
				continue;
			}
		} catch (e) {
			console.error(`Failed to read or parse ${file}:`, e);
			continue;
		}
		// Write the SQF call
		outputLines.push(
			`["${name}", ${JSON.stringify(loadoutArray)}, true] call ace_arsenal_fnc_addDefaultLoadout;`,
		);
	}
	await mkdir(path.dirname(outputFile), { recursive: true });
	await Bun.write(outputFile, outputLines.join("\n") + "\n");
	// Subtract 1 for the comment line
	console.log(`Wrote ${outputLines.length - 1} loadouts to ${outputFile}`);
} catch (err) {
	console.error("Error generating loadouts:", err);
	process.exit(1);
}
