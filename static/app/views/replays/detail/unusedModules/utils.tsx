import webpackStats from '../../../../../../mock_chunk_data.json';

type WebpackModule = {
  children: string[];
  id: string;
  size: number;
};
export type WebpackChunk = {
  id: string;
  modules: WebpackModule[];
};

function getModulesWithSize(chunks: WebpackChunk[]): Record<string, number> {
  return Object.fromEntries(
    chunks.flatMap(chunk => chunk.modules.map(module => [module.id, module.size]))
  );
}

function getModulesbyName(chunks: WebpackChunk[]): Record<string, WebpackModule> {
  return Object.fromEntries(
    chunks.flatMap(chunk => chunk.modules.map(module => [module.id, module]))
  );
}

// function normalizeModuleName(name: string) {
//   return name.replace('/^\\./', '').replace(/\.tsx$/, '');
// }

function getModulesWithCumulativeSize(
  chunks: WebpackChunk[]
): Record<string, [number, number, number]> {
  const modulesByName = getModulesbyName(chunks);
  const cumulative: Record<string, [number, number, number]> = {};

  const getSizeForModule = (module: WebpackModule, visitedList: string[]) => {
    const id = module.id;
    if (cumulative[id]) {
      return cumulative[id];
    }

    if (module.children.length === 0) {
      cumulative[id] = [module.size, module.size, 0];
      return cumulative[id];
    }

    cumulative[id] = module.children.reduce(
      ([moduleSize, totalSize, totalDeps], childName) => {
        if (visitedList.includes(childName)) {
          // cyclic call, we're looking at the same child again.
          return [moduleSize, totalSize, totalDeps];
        }

        const childModule = modulesByName[childName] || {
          children: [],
          id: childName,
          size: 0,
        };

        visitedList.push(childName);
        cumulative[childName] = getSizeForModule(childModule, visitedList);
        const [childSize, _childAggSize, childDeps] = cumulative[childName];
        return [moduleSize, totalSize + childSize, totalDeps + childDeps];
      },
      [module.size, module.size, module.children.length]
    );

    return cumulative[id];
  };

  chunks.forEach(chunk => {
    chunk.modules.forEach(module => {
      const id = module.id;
      if (cumulative[id]) {
        return;
      }
      cumulative[id] = getSizeForModule(module, [id]);
    });
  });

  return cumulative;
}

export const MODULES_WITH_SIZE = getModulesWithSize(webpackStats as WebpackChunk[]);

export const MODULES_WITH_CUMULATIVE_SIZE = getModulesWithCumulativeSize(
  webpackStats as WebpackChunk[]
);
