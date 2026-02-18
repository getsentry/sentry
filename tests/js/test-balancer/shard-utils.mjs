const SUITE_P50_DURATION_MS = 1500;

/**
 * @param {string} filePath
 * @param {string} cwd
 * @returns {string}
 */
export function toRepoRelativePath(filePath, cwd) {
  if (!filePath) {
    return filePath;
  }
  if (filePath.startsWith(cwd)) {
    return filePath.slice(cwd.length);
  }
  return filePath;
}

/**
 * @param {number} nodeIndex
 * @param {number} nodeTotal
 * @param {ReadonlyArray<string>} allTests
 * @param {Record<string, number>} testStats
 * @returns {string[]}
 */
export function getTestsForGroup(nodeIndex, nodeTotal, allTests, testStats) {
  const speculatedSuiteDuration = Object.values(testStats).reduce((a, b) => a + b, 0);
  const targetDuration = speculatedSuiteDuration / nodeTotal;

  if (speculatedSuiteDuration <= 0) {
    throw new Error('Speculated suite duration is <= 0');
  }

  const tests = new Map();

  for (const [test, duration] of Object.entries(testStats)) {
    if (duration <= 0) {
      throw new Error(`Test duration is <= 0 for ${test}`);
    }
    tests.set(test, duration);
  }

  for (const test of allTests) {
    if (tests.has(test)) {
      continue;
    }
    tests.set(test, SUITE_P50_DURATION_MS);
  }

  if (tests.size < allTests.length) {
    throw new Error(
      `All tests should be accounted for, missing ${allTests.length - tests.size}`
    );
  }

  const groups = [];
  const testsSortedByPath = Array.from(tests.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (let group = 0; group < nodeTotal; group++) {
    groups[group] = [];
    let duration = 0;

    while (duration < targetDuration && testsSortedByPath.length > 0) {
      const peek = testsSortedByPath[testsSortedByPath.length - 1];
      if (!peek) {
        throw new TypeError('Received falsy test while peeking');
      }
      if (duration + peek[1] > targetDuration && peek[1] > 30_000) {
        break;
      }

      const nextTest = testsSortedByPath.pop();
      if (!nextTest) {
        throw new TypeError('Received falsy test');
      }

      groups[group].push(nextTest[0]);
      duration += nextTest[1];
    }
  }

  let i = 0;
  while (testsSortedByPath.length > 0) {
    const nextTest = testsSortedByPath.pop();
    if (!nextTest) {
      throw new TypeError('Received falsy test');
    }
    groups[i % nodeTotal].push(nextTest[0]);
    i++;
  }

  for (const test of allTests) {
    if (!tests.has(test)) {
      throw new Error(`Test ${test} is not accounted for`);
    }
  }

  if (!groups[nodeIndex]) {
    throw new Error(`No tests found for node ${nodeIndex}`);
  }

  return groups[nodeIndex];
}

/**
 * @param {number} nodeIndex
 * @param {number} nodeTotal
 * @param {ReadonlyArray<string>} allTests
 * @returns {string[]}
 */
export function getFallbackTestsForGroup(nodeIndex, nodeTotal, allTests) {
  const tests = [...allTests].sort((a, b) => b.localeCompare(a));
  const length = tests.length;
  const size = Math.floor(length / nodeTotal);
  const remainder = length % nodeTotal;
  const offset = Math.min(nodeIndex, remainder) + nodeIndex * size;
  const chunk = size + (nodeIndex < remainder ? 1 : 0);
  return tests.slice(offset, offset + chunk);
}

/**
 * @param {number} nodeIndex
 * @param {number} nodeTotal
 * @param {ReadonlyArray<string>} allTests
 * @param {Record<string, number> | null} balance
 * @returns {string[]}
 */
export function selectTestsForGroup(nodeIndex, nodeTotal, allTests, balance) {
  if (balance) {
    return getTestsForGroup(nodeIndex, nodeTotal, allTests, balance);
  }
  return getFallbackTestsForGroup(nodeIndex, nodeTotal, allTests);
}
