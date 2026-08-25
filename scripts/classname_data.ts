const CLASSNAME_PATTERN = /^[A-Za-z0-9_]+$/;

function validationError(source: string, lineNumber: number, message: string): Error {
  return new Error(`${source}:${lineNumber}: ${message}`);
}

export function parseClassnameData(text: string, source = "classname data"): string[] {
  let normalized = text.startsWith("\uFEFF") ? text.slice(1) : text;
  normalized = normalized.replaceAll("\r\n", "\n");

  if (normalized.includes("\r")) {
    throw new Error(`${source}: unsupported carriage return`);
  }

  if (normalized.endsWith("\n")) {
    normalized = normalized.slice(0, -1);
  }

  if (normalized.length === 0) return [];

  return normalized.split("\n").map((classname, index) => {
    const lineNumber = index + 1;
    if (classname.length === 0) {
      throw validationError(source, lineNumber, "blank rows are not allowed");
    }
    if (classname.trim() !== classname) {
      throw validationError(source, lineNumber, "surrounding whitespace is not allowed");
    }
    if (!CLASSNAME_PATTERN.test(classname)) {
      throw validationError(source, lineNumber, `invalid classname ${JSON.stringify(classname)}`);
    }
    return classname;
  });
}

export function serializeClassnameData(classnames: readonly string[], source = "classname data"): string {
  for (const [index, classname] of classnames.entries()) {
    if (!CLASSNAME_PATTERN.test(classname)) {
      throw validationError(source, index + 1, `invalid classname ${JSON.stringify(classname)}`);
    }
  }
  return classnames.join("\n");
}

export function isClassnameDataFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".csv");
}