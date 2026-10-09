/**
 * Jest evaluates every module a spec imports once per spec file, so anything the
 * shared setup files or the render helper import is paid by every spec file in
 * every CI run. The module budget specs catch an innocent-looking import that
 * drags a large part of the app into every spec.
 *
 * If a budget fails, the error lists where the loaded modules come from. Find the
 * import that pulled in the new area and move what it needs into a smaller
 * module instead of raising the budget.
 */

function area(file: string) {
  const pkg =
    /\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)\//.exec(file);
  if (pkg) {
    return `node_modules/${pkg[1]}`;
  }
  const local = /\/(static\/(?:app|gsApp)\/[^/]+(?:\/[^/.]+)?|tests\/js\/[^/]+)\//.exec(
    file
  );
  return local?.[1] ?? file;
}

export function expectWithinModuleBudget(label: string, budget: number) {
  // Jest backs `require.cache` with the current spec file's module registry.
  const loaded = Object.keys(require.cache);
  if (loaded.length > budget) {
    const counts = new Map<string, number>();
    for (const file of loaded) {
      const name = area(file);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const largest = [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => `  ${String(count).padStart(5)}  ${name}`)
      .join('\n');
    throw new Error(
      `${label} loads ${loaded.length} modules, over its budget of ${budget}.\n` +
        `Largest areas:\n${largest}`
    );
  }
  expect(loaded.length).toBeLessThanOrEqual(budget);
}
