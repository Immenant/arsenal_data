# Arsenal Generator

A utility for managing and generating ACE3 Arsenal configuration files for Arma 3 mods.

## Description

This tool helps with:

- Combining newline-delimited classname lists into a single arsenal configuration
- Generating proper SQF format initialization scripts
- Removing duplicates and validating arsenal contents
- Extracting class names from mod configuration files

## Installation

```bash
bun install
```

## Usage

### Generate Arsenal Files

Combines `.csv` files from unit folders under `data_arsenal/` into arsenal configuration files. Each file contains one classname per row with no header, quoting, commas, blank rows, or surrounding whitespace:

```csv
ACE_fieldDressing
ACE_elasticBandage
ACE_packingBandage
```

```bash
bun run arsenal --unit 1mercian
```

Options:

- `--no-check`: Skip duplicate checking
- `--unit`, `-u`: Unit folder name under `data_arsenal/`
- `--all`, `-a`: Generate for all units (and an `all` combined preset)

Output files will be created in the `output` directory:

- `init_arsenal_[foldername].sqf`: For direct initialization
- `arsenal_[foldername].sqf`: For execution with parameters

### Extract Class Names

Extract class names from an Arma 3 mod's config.cpp file:

```bash
bun run extract path/to/config.cpp
```

The extracted class names are output one per line, ready to place in an arsenal `.csv` file.

### Migrate Arsenal Data

Convert JSON classname arrays in `data_arsenal/` and `archive_arsenal/` to the newline-delimited `.csv` format:

```bash
bun run migrate-arsenal-data
```

The migration validates all source files and destination names before writing, then verifies each converted file before deleting its JSON source. Loadout and reference JSON files are not migrated.

## Project Structure

- `scripts/generate_arsenal.ts`: Main script for generating arsenal configurations
- `scripts/generate_loadouts.ts`: Generates `output/loadouts.sqf` from `data_loadouts/`
- `scripts/extract_config.ts`: Utility for extracting class names from config files

## Notes

This tool is designed for use with ACE3 Arsenal in Arma 3, helping with the creation and management of custom arsenal boxes.