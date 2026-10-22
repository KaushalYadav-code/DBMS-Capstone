const VERSION_RE = /^[vV]?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const PARTIAL_RE = /^[vV]?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function parseSemver(value) {
  if (typeof value !== "string") return null;
  const match = VERSION_RE.exec(value.trim());
  if (!match) return null;
  const prerelease = match[4] ? match[4].split(".") : [];
  if (prerelease.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith("0"))) return null;
  return { core: [BigInt(match[1]), BigInt(match[2]), BigInt(match[3])], prerelease };
}

function comparePrerelease(left, right) {
  if (!left.length && !right.length) return 0;
  if (!left.length) return 1;
  if (!right.length) return -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] === undefined) return -1;
    if (right[index] === undefined) return 1;
    const a = left[index];
    const b = right[index];
    if (a === b) continue;
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return BigInt(a) < BigInt(b) ? -1 : 1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

export function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] < b.core[index] ? -1 : 1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

function parsePartial(value) {
  if (typeof value !== "string") return null;
  const match = PARTIAL_RE.exec(value.trim());
  if (!match) return null;
  const parts = match.slice(1, 4);
  let precision = 0;
  let wildcard = false;
  for (const part of parts) {
    if (part === undefined) break;
    if (/^[xX*]$/.test(part)) {
      wildcard = true;
      break;
    }
    precision += 1;
  }
  if (match[4] && (precision !== 3 || wildcard)) return null;
  if (!precision && !wildcard) return null;
  const core = [0n, 0n, 0n];
  for (let index = 0; index < precision; index += 1) {
    const part = parts[index];
    if (part.length > 1 && part.startsWith("0")) return null;
    core[index] = BigInt(part);
  }
  const prerelease = match[4] ? match[4].split(".") : [];
  if (prerelease.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith("0"))) return null;
  return { core, precision, wildcard: wildcard || precision < 3, prerelease };
}

function compareParsed(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] < right.core[index] ? -1 : 1;
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function prefixBounds(partial) {
  const lower = { core: [...partial.core], prerelease: partial.prerelease };
  const upperCore = [...partial.core];
  const bumpIndex = Math.max(0, partial.precision - 1);
  upperCore[bumpIndex] += 1n;
  for (let index = bumpIndex + 1; index < 3; index += 1) upperCore[index] = 0n;
  return { lower, upper: { core: upperCore, prerelease: [] } };
}

function testAtom(version, token) {
  if (token === "*" || /^[xX]$/.test(token)) return true;
  const match = /^(\^|~|>=|<=|>|<|=)?(.*)$/.exec(token);
  const operator = match[1] || "";
  const partial = parsePartial(match[2]);
  if (!partial) return null;
  const comparison = compareParsed(version, { core: partial.core, prerelease: partial.prerelease });
  if (!operator) {
    if (partial.wildcard) {
      const { lower, upper } = prefixBounds(partial);
      return compareParsed(version, lower) >= 0 && compareParsed(version, upper) < 0;
    }
    return comparison === 0;
  }
  if (operator === "^" || operator === "~") {
    const { lower } = prefixBounds(partial);
    let bumpIndex;
    if (operator === "~") bumpIndex = partial.precision === 1 ? 0 : 1;
    else {
      bumpIndex = partial.core.findIndex((part) => part !== 0n);
      if (bumpIndex < 0) bumpIndex = Math.max(0, partial.precision - 1);
    }
    const upperCore = [...partial.core];
    upperCore[bumpIndex] += 1n;
    for (let index = bumpIndex + 1; index < 3; index += 1) upperCore[index] = 0n;
    return compareParsed(version, lower) >= 0 && compareParsed(version, { core: upperCore, prerelease: [] }) < 0;
  }
  const { lower, upper } = prefixBounds(partial);
  if (operator === ">=") return compareParsed(version, lower) >= 0;
  if (operator === ">") return partial.wildcard ? compareParsed(version, upper) >= 0 : comparison > 0;
  if (operator === "<") return compareParsed(version, lower) < 0;
  if (operator === "<=") return partial.wildcard ? compareParsed(version, upper) < 0 : comparison <= 0;
  if (operator === "=") return partial.wildcard
    ? compareParsed(version, lower) >= 0 && compareParsed(version, upper) < 0
    : comparison === 0;
  return null;
}

function testBranch(version, branch) {
  const hyphen = /^\s*(\S+)\s+-\s+(\S+)\s*$/.exec(branch);
  if (hyphen) {
    const low = parsePartial(hyphen[1]);
    const high = parsePartial(hyphen[2]);
    if (!low || !high) return null;
    const lower = { core: low.core, prerelease: low.prerelease };
    const lowerComparison = compareParsed(version, lower);
    const { upper: highUpper } = prefixBounds(high);
    const upperComparison = compareParsed(version, { core: high.core, prerelease: high.prerelease });
    return lowerComparison >= 0 && (high.wildcard ? compareParsed(version, highUpper) < 0 : upperComparison <= 0);
  }

  const pieces = branch.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!pieces.length) return null;
  const atoms = [];
  for (let index = 0; index < pieces.length; index += 1) {
    if (/^(?:\^|~|>=|<=|>|<|=)$/.test(pieces[index])) {
      if (pieces[index + 1] === undefined) return null;
      atoms.push(pieces[index] + pieces[index + 1]);
      index += 1;
    } else atoms.push(pieces[index]);
  }
  for (const atom of atoms) {
    const result = testAtom(version, atom);
    if (result === null) return null;
    if (!result) return false;
  }
  return true;
}

// Returns null for missing or unsupported range syntax so callers never guess.
export function satisfiesSemverRange(versionValue, rangeValue) {
  const version = parseSemver(versionValue);
  if (!version || typeof rangeValue !== "string" || !rangeValue.trim()) return null;
  const branches = rangeValue.split("||");
  if (branches.some((branch) => !branch.trim())) return null;
  let supported = false;
  let unsupported = false;
  for (const branch of branches) {
    const result = testBranch(version, branch);
    if (result === null) {
      unsupported = true;
      continue;
    }
    supported = true;
    if (result) return true;
  }
  return unsupported || !supported ? null : false;
}
