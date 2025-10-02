import type {TreemapElement, TreemapType} from 'sentry/views/preprod/types/appSizeTypes';

type SearchCtx = {
  hasPath: boolean;
  isExact: boolean;
  // lowercased path parts if hasPath
  lastPart: string;
  // backticks stripped
  lcTerm: string;
  parts: string[];
  raw: string;
  term: string; // lowercased last segment (for direct matches)
};

export function filterTreemapElement(
  element: TreemapElement,
  searchQuery: string,
  parentPath = '',
  selectedCategories?: Set<TreemapType>
): TreemapElement | null {
  const ctx = makeSearchCtx(searchQuery);
  const hasSearchFilter = !!ctx.term;
  const hasCategoryFilter = selectedCategories && selectedCategories.size > 0;

  if (!hasSearchFilter && !hasCategoryFilter) return element;

  // Root is a special case, only keep if children match.
  if (parentPath === '') {
    const filteredChildren = filterChildren(element.children, ctx, 0, selectedCategories);
    return filteredChildren.length ? {...element, children: filteredChildren} : null;
  }

  const filtered = filterNode(element, ctx, 0, selectedCategories);
  return filtered;
}

/**
 * Build a normalized, lowercased search context once.
 */
function makeSearchCtx(searchQuery: string): SearchCtx {
  const raw = searchQuery;
  const trimmed = raw.trim();
  const isExact = trimmed.startsWith('`') && trimmed.endsWith('`');
  const stripped = isExact
    ? trimmed.slice(1, -1)
    : trimmed.startsWith('`')
      ? trimmed.slice(1)
      : trimmed;

  const hasPath = stripped.includes('/');
  const lcTerm = stripped.toLowerCase();
  const parts = hasPath ? lcTerm.split('/') : [];
  const lastPart = hasPath ? (parts[parts.length - 1] ?? '') : lcTerm;

  return {raw, term: stripped, lcTerm, isExact, hasPath, parts, lastPart};
}

function advancePathIdx(nodeNameLC: string, parts: string[], idx: number): number {
  if (idx >= parts.length) return idx;
  return nodeNameLC.includes(parts[idx] ?? '') ? idx + 1 : idx;
}

function directNameMatch(nodeNameLC: string, ctx: SearchCtx): boolean {
  return nodeNameLC.includes(ctx.hasPath ? ctx.lastPart : ctx.lcTerm);
}

function currentNodeMatches(
  nodeNameLC: string,
  ctx: SearchCtx,
  pathIdx: number
): boolean {
  if (!ctx.term) return true;
  if (!ctx.hasPath) return nodeNameLC.includes(ctx.lcTerm);

  if (pathIdx >= ctx.parts.length) return true; // already satisfied the whole path
  const needed = ctx.parts[pathIdx];
  return needed ? nodeNameLC.includes(needed) : false; // must advance to count as a match
}

function categoryMatches(
  element: TreemapElement,
  selectedCategories?: Set<TreemapType>
): boolean {
  if (!selectedCategories || selectedCategories.size === 0) return true;
  return selectedCategories.has(element.type);
}

function filterNode(
  element: TreemapElement,
  ctx: SearchCtx,
  pathIdx: number,
  selectedCategories?: Set<TreemapType>
): TreemapElement | null {
  const nameLC = element.name.toLowerCase();
  const currentMatches = currentNodeMatches(nameLC, ctx, pathIdx);
  const nextIdx = ctx.hasPath ? advancePathIdx(nameLC, ctx.parts, pathIdx) : pathIdx;
  const currentDirectlyMatches = directNameMatch(nameLC, ctx);
  const categoryOk = categoryMatches(element, selectedCategories);

  if (!categoryOk && !element.children?.length) {
    return null;
  }

  if (!ctx.term) {
    const kids = filterChildren(element.children, ctx, pathIdx, selectedCategories);
    return !categoryOk && kids.length === 0 ? null : {...element, children: kids};
  }

  // Exact search: keep node but only with matching descendants.
  if (currentMatches && ctx.isExact) {
    const kids = filterChildren(element.children, ctx, nextIdx, selectedCategories);
    return !categoryOk && kids.length === 0 ? null : {...element, children: kids};
  }

  if (currentMatches && currentDirectlyMatches) {
    // App containers: filter recursively to avoid unrelated content.
    const isAppContainer =
      nameLC.endsWith('.app') ||
      nameLC.endsWith('.framework') ||
      nameLC.endsWith('.bundle') ||
      nameLC.endsWith('.plugin');

    if (categoryOk && !isAppContainer) {
      // Regular folders: include all children as-is (avoid cloning if not needed).
      // Return a new object to preserve immutability of the node, but reuse children ref.
      return {...element, children: element.children};
    }

    const kids = filterChildren(element.children, ctx, nextIdx, selectedCategories);
    return !categoryOk && kids.length === 0 ? null : {...element, children: kids};
  }

  if (currentMatches) {
    // Intermediate path matches: filter children recursively.
    const kids = filterChildren(element.children, ctx, nextIdx, selectedCategories);
    return !categoryOk && kids.length === 0 ? null : {...element, children: kids};
  }

  // Current node doesn’t match: try children.
  const kids = filterChildren(element.children, ctx, nextIdx, selectedCategories);
  return kids.length ? {...element, children: kids} : null;
}

function filterChildren(
  children: TreemapElement[] | undefined,
  ctx: SearchCtx,
  pathIdx: number,
  selectedCategories?: Set<TreemapType>
): TreemapElement[] {
  if (!children || children.length === 0) return [];
  const out: TreemapElement[] = [];
  for (const child of children) {
    const filtered = filterNode(child, ctx, pathIdx, selectedCategories);
    if (filtered) out.push(filtered);
  }
  return out;
}
