import type {CMDKActionData} from 'sentry/components/commandPalette/ui/cmdk';
import type {CollectionTreeNode} from 'sentry/components/commandPalette/ui/collection';
import type {CMDKNavStack} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {t} from 'sentry/locale';
import {fzf} from 'sentry/utils/search/fzf';

export type CMDKFlatItem = CollectionTreeNode<CMDKActionData> & {
  listItemType: 'action' | 'section';
};

interface CMDKActionSection {
  header: CMDKFlatItem | undefined;
  items: CMDKFlatItem[];
}

export interface CommandPaletteScore {
  length: number;
  matched: boolean;
  score: number;
}

export function getChainedReturnFocusKey(
  stack: CMDKNavStack | null,
  anchorKey: string
): string | number | null {
  let current = stack;
  let returnFocusKey: string | number | null = null;

  while (current && current.value.key !== anchorKey) {
    returnFocusKey = current.value.returnFocusKey ?? returnFocusKey;
    current = current.previous;
  }

  return returnFocusKey;
}

export function findCollectionNode(
  nodes: Array<CollectionTreeNode<CMDKActionData>>,
  key: string
): CollectionTreeNode<CMDKActionData> | undefined {
  for (const node of nodes) {
    if (node.key === key) {
      return node;
    }
    const match = findCollectionNode(node.children, key);
    if (match) {
      return match;
    }
  }
  return undefined;
}

export function filterActionPanelOnlyNodes(
  nodes: Array<CollectionTreeNode<CMDKActionData>>
): Array<CollectionTreeNode<CMDKActionData>> {
  return nodes.flatMap(node =>
    node.actionPanel?.placement === 'panel-only'
      ? []
      : [{...node, children: filterActionPanelOnlyNodes(node.children)}]
  );
}

export function collectPanelActions(
  nodes: Array<CollectionTreeNode<CMDKActionData>>
): CMDKFlatItem[] {
  return nodes
    .flatMap(node => [
      ...(node.actionPanel
        ? [
            {
              ...node,
              display: {
                ...node.display,
                label: node.actionPanel.label,
                labelSuffix: undefined,
                trailingItem: undefined,
              },
              listItemType: 'action' as const,
            },
          ]
        : []),
      ...collectPanelActions(node.children),
    ])
    .sort(
      (firstAction, secondAction) =>
        (firstAction.actionPanel?.order ?? Number.MAX_SAFE_INTEGER) -
        (secondAction.actionPanel?.order ?? Number.MAX_SAFE_INTEGER)
    );
}

export function matchesActionContext(
  selectedContext: string,
  panelContext: string | undefined
): boolean {
  return (
    panelContext !== undefined &&
    (selectedContext === panelContext || selectedContext.startsWith(`${panelContext}:`))
  );
}

/**
 * Pre-sorts root-level nodes according to their command-palette slot.
 */
export function presortBySlot(
  nodes: Array<CollectionTreeNode<CMDKActionData>>
): Array<CollectionTreeNode<CMDKActionData>> {
  const slotOrder = {task: 0, page: 1, global: 2} as const;
  return nodes.toSorted(
    (a, b) =>
      (a.slot === undefined ? Number.MAX_SAFE_INTEGER : slotOrder[a.slot]) -
      (b.slot === undefined ? Number.MAX_SAFE_INTEGER : slotOrder[b.slot])
  );
}

export function sortByExplicitOrder(
  nodes: Array<CollectionTreeNode<CMDKActionData>>
): Array<CollectionTreeNode<CMDKActionData>> {
  return nodes
    .map(node => ({...node, children: sortByExplicitOrder(node.children)}))
    .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function isContextualNode(node: CollectionTreeNode<CMDKActionData>): boolean {
  return node.slot === 'task' || node.slot === 'page';
}

function scoreNode(
  query: string,
  node: CollectionTreeNode<CMDKActionData>
): CommandPaletteScore {
  const label = node.display.label;
  const details = node.display.details ?? '';
  const keywords = node.keywords ?? [];

  // Score each field independently and take the best result. This lets
  // fzf's built-in exact-match bonus fire naturally (e.g. query === label)
  // and avoids false cross-field subsequence matches from string concatenation.
  let best = -Infinity;
  let bestLength = Infinity;
  let matched = false;
  for (const candidate of [label, details, ...keywords]) {
    if (!candidate) {
      continue;
    }
    // Very short fuzzy queries create noisy subsequence matches (for example,
    // "go" matching "Grouping"). Keep those searches predictable by requiring
    // the characters to be contiguous, like Linear's quick search.
    if (query.length <= 2) {
      const index = candidate.toLocaleLowerCase().indexOf(query);
      if (index !== -1) {
        const score = query.length * 100 - index + (node.children.length > 0 ? 50 : 0);
        if (score > best) {
          best = score;
          bestLength = candidate.length;
        } else if (score === best) {
          bestLength = Math.min(bestLength, candidate.length);
        }
        matched = true;
      }
      continue;
    }
    const result = fzf(candidate, query, false);
    if (result.end !== -1 && result.score > best) {
      best = result.score;
      bestLength = candidate.length;
      matched = true;
    } else if (result.end !== -1 && result.score === best) {
      bestLength = Math.min(bestLength, candidate.length);
      matched = true;
    }
  }
  return {
    length: matched ? bestLength : Infinity,
    matched,
    score: matched ? best : 0,
  };
}

function compareCommandPaletteScores(
  a: CommandPaletteScore | undefined,
  b: CommandPaletteScore | undefined
): number {
  return (
    (b?.score ?? 0) - (a?.score ?? 0) || (a?.length ?? Infinity) - (b?.length ?? Infinity)
  );
}

function getBestItemScore(
  item: CMDKFlatItem,
  scores: Map<string, CommandPaletteScore>,
  sortLeafResults: boolean
): CommandPaletteScore | undefined {
  if (item.children.length > 0) {
    return item.children
      .map(child => scores.get(child.key))
      .filter(score => score !== undefined)
      .sort(compareCommandPaletteScores)[0];
  }

  return sortLeafResults ? scores.get(item.key) : undefined;
}

export function scoreTree(
  nodes: Array<CollectionTreeNode<CMDKActionData>>,
  scores: Map<string, CommandPaletteScore>,
  query: string
): void {
  function dfs(node: CollectionTreeNode<CMDKActionData>) {
    for (const child of node.children) {
      dfs(child);
    }
    const s = scoreNode(query, node);
    if (s.matched) {
      scores.set(node.key, s);
    }
  }
  for (const node of nodes) {
    dfs(node);
  }
}

function markSubtreeSeen(
  node: CollectionTreeNode<CMDKActionData>,
  seen: Set<string>
): void {
  seen.add(node.key);
  for (const child of node.children) {
    markSubtreeSeen(child, seen);
  }
}

export function flattenActions(
  nodes: Array<CollectionTreeNode<CMDKActionData>>,
  scores: Map<string, CommandPaletteScore> | null,
  sortLeafResults = false
): [CMDKFlatItem[], Map<string, string[]>] {
  // Browse mode: show each top-level node and its direct children.
  if (!scores) {
    const results: CMDKFlatItem[] = [];
    for (const node of nodes) {
      const isGroup = node.children.length > 0;
      // Skip non-group nodes that have no executable action — they are
      // empty placeholders (e.g. a CMDKGroup whose children didn't render).
      // Prompt/resource/target nodes are actionable leaf items even though they lack
      // `to` or `onAction`, so only skip when none of the action types apply.
      if (!isGroup && !('to' in node) && !('onAction' in node) && !node.targetAction) {
        const hasPromptOrResource =
          ('prompt' in node && !!node.prompt) ||
          ('resource' in node && !!node.resource) ||
          ('textInput' in node && !!node.textInput);
        if (!hasPromptOrResource || isEmptyResourceNode(node)) {
          continue;
        }
      }

      if (isGroup) {
        if ('prompt' in node && node.prompt) {
          results.push({...node, listItemType: 'action'});
          continue;
        }
        const children = node.children
          .filter(child => !isEmptyResourceNode(child))
          .map(child => ({...child, listItemType: 'action' as const}));
        if (!children.length) {
          continue;
        }
        results.push(makeSectionAction(node));
        const visibleChildren = getLimitedChildren(children, node.limit);
        results.push(...visibleChildren);
        if (shouldShowSeeMore(children.length, node.limit)) {
          results.push(makeSeeMoreAction(node));
        }
      } else {
        results.push({...node, listItemType: 'action'});
      }
    }
    return [results, new Map()];
  }

  // Search mode: DFS all nodes, collect as flat list, sort groups by max child
  // score, then filter to only matched items.
  const collected: CMDKFlatItem[] = [];

  function dfs(node: CollectionTreeNode<CMDKActionData>) {
    const isGroup = node.children.length > 0;
    collected.push({...node, listItemType: isGroup ? 'section' : 'action'});
    if (isGroup) {
      for (const child of node.children) {
        dfs(child);
      }
    }
  }
  for (const node of nodes) {
    dfs(node);
  }

  const nodeMap = new Map<string, CollectionTreeNode<CMDKActionData>>();
  for (const item of collected) {
    nodeMap.set(item.key, item);
  }

  // Pre-compute the root ancestor key for every node. The sort below uses this
  // as the primary key so all results from the same top-level section stay
  // grouped together, regardless of how individual sub-groups score.
  const nodeRootKey = new Map<string, string>();
  for (const item of collected) {
    let root: CollectionTreeNode<CMDKActionData> = item;
    while (root.parent !== null) {
      const parent = nodeMap.get(root.parent);
      if (!parent) {
        break;
      }
      root = parent;
    }
    nodeRootKey.set(item.key, root.key);
  }

  // Best score among all matched descendants for each root section. Used as
  // the primary sort key so sections are ordered by their top relevance signal.
  // Root-level leaf nodes (parent === null, no children) are excluded: they are
  // their own root and inherit the old behaviour of sorting by DFS order rather
  // than match quality, consistent with getBestItemScore returning undefined for
  // leaves when sortLeafResults is false.
  const rootBestScore = new Map<string, CommandPaletteScore>();
  for (const [key, score] of scores) {
    const node = nodeMap.get(key);
    if (node?.parent === null && node.children.length === 0) {
      continue;
    }
    const rootKey = nodeRootKey.get(key);
    if (rootKey === undefined) {
      continue;
    }
    const current = rootBestScore.get(rootKey);
    if (current === undefined || compareCommandPaletteScores(score, current) < 0) {
      rootBestScore.set(rootKey, score);
    }
  }

  // Sort with root section as the primary key so every node from the same
  // top-level section stays together in the output. Within each root, order
  // groups by their best child score so the most relevant sub-section surfaces
  // first. When we are inside an expanded group we also sort leaf actions by
  // their own score so the full result list matches the limited preview ordering.
  // Sections with a "cmdk:supplementary:" reserved key always sort last,
  // regardless of score.
  collected.sort((a, b) => {
    const aRootKey = nodeRootKey.get(a.key)!;
    const bRootKey = nodeRootKey.get(b.key)!;
    if (aRootKey !== bRootKey) {
      const aIsSupplementary = aRootKey.startsWith('cmdk:supplementary:');
      const bIsSupplementary = bRootKey.startsWith('cmdk:supplementary:');
      if (aIsSupplementary !== bIsSupplementary) {
        return aIsSupplementary ? 1 : -1;
      }
      return compareCommandPaletteScores(
        rootBestScore.get(aRootKey),
        rootBestScore.get(bRootKey)
      );
    }
    return compareCommandPaletteScores(
      getBestItemScore(a, scores, sortLeafResults),
      getBestItemScore(b, scores, sortLeafResults)
    );
  });

  // Track processed keys so children beyond a group's limit cannot resurface as
  // standalone flat items later in the traversal.
  const seen = new Set<string>();
  const prefixMap = new Map<string, string[]>();
  const usedSectionHeaders = new Set<string>();
  const matchedRootGroups = new Set(
    collected
      .filter(
        item =>
          item.parent === null &&
          item.children.length > 0 &&
          scores.get(item.key)?.matched
      )
      .map(item => item.key)
  );

  const flattened = collected.flatMap((item): CMDKFlatItem[] => {
    if (seen.has(item.key)) {
      return [];
    }
    seen.add(item.key);

    const rootKey = nodeRootKey.get(item.key);
    if (item.parent !== null && rootKey && matchedRootGroups.has(rootKey)) {
      return [];
    }

    if (item.children.length > 0) {
      const matched = item.children.filter(
        c => scores.get(c.key)?.matched && !isEmptyResourceNode(c) && !seen.has(c.key)
      );
      const itemMatched = scores.get(item.key)?.matched;
      if (matched.length === 0 && itemMatched) {
        // A matching group is a single drill-in result. Expanding all of its
        // unrelated children makes search look like browse mode and can surface
        // synthetic entries such as "Settings → See all" for the query "go".
        let root: CollectionTreeNode<CMDKActionData> = item;
        while (root.parent !== null) {
          const parent = nodeMap.get(root.parent);
          if (!parent) {
            break;
          }
          root = parent;
        }
        if (root.key === item.key) {
          const previewChildren = item.children
            .filter(child => !isEmptyResourceNode(child))
            .slice(0, item.limit ?? 6);
          for (const child of item.children) {
            markSubtreeSeen(child, seen);
          }
          usedSectionHeaders.add(item.key);
          return [
            makeSectionAction(item),
            ...previewChildren.map(child => ({
              ...child,
              children: [],
              listItemType: 'action' as const,
            })),
          ];
        }
        const sectionHeader =
          root.key === item.key || usedSectionHeaders.has(root.key)
            ? []
            : [makeSectionAction(root)];
        usedSectionHeaders.add(root.key);
        markSubtreeSeen(item, seen);
        return [
          ...sectionHeader,
          {...item, children: [], listItemType: 'action' as const},
        ];
      }
      const candidateChildren = matched;
      if (!candidateChildren.length) {
        return [];
      }
      const sortedMatches = candidateChildren.sort((a, b) =>
        compareCommandPaletteScores(scores.get(a.key), scores.get(b.key))
      );
      const limitedMatches = getLimitedChildren(sortedMatches, item.limit);
      // Mark every child and their entire subtrees as seen — including those
      // beyond the limit — so neither over-limit children nor any of their
      // nested descendants can resurface as independent flat items later.
      for (const child of item.children) {
        markSubtreeSeen(child, seen);
      }
      // Walk the ancestor chain inline to find the root section for this group.
      let root: CollectionTreeNode<CMDKActionData> = item;
      const intermediatePath: string[] = [];
      while (root.parent !== null) {
        const parent = nodeMap.get(root.parent);
        if (!parent) {
          break;
        }
        intermediatePath.unshift(root.display.label);
        root = parent;
      }
      const isNested = root.key !== item.key;
      const seeMore = shouldShowSeeMore(candidateChildren.length, item.limit);

      if (isNested) {
        for (const child of limitedMatches) {
          prefixMap.set(child.key, intermediatePath);
        }
        if (seeMore) {
          // Render-time prefix for the "See all" item — same path as its siblings.
          prefixMap.set(`${item.key}:see-more`, intermediatePath);
          // Source-label hint so getSourceAction can recover the group label for
          // analytics/navigation even though the original section header is not
          // emitted. The distinct `:source-label` suffix avoids collision with the
          // render-time prefix entry above.
          prefixMap.set(`${item.key}:see-more:source-label`, [item.display.label]);
        }
        const sectionHeader = usedSectionHeaders.has(root.key)
          ? []
          : [makeSectionAction(root)];
        usedSectionHeaders.add(root.key);
        return [
          ...sectionHeader,
          ...limitedMatches.map(c => ({
            ...c,
            listItemType: 'action' as const,
          })),
          ...(seeMore ? [makeSeeMoreAction(item)] : []),
        ];
      }

      // A nested descendant processed earlier may have already emitted this item's
      // section header via the root-bubbling path — skip it to avoid a duplicate key.
      const sectionHeader = usedSectionHeaders.has(item.key)
        ? []
        : [makeSectionAction(item)];
      usedSectionHeaders.add(item.key);
      return [
        ...sectionHeader,
        ...limitedMatches.map(c => ({
          ...c,
          listItemType: 'action' as const,
        })),
        ...(seeMore ? [makeSeeMoreAction(item)] : []),
      ];
    }

    // Skip resource nodes with no children — they are async group containers that
    // returned 0 results and have no executable action of their own.
    if (isEmptyResourceNode(item)) {
      return [];
    }
    return scores.get(item.key)?.matched ? [{...item, listItemType: 'action'}] : [];
  });

  return [flattened, prefixMap];
}

function getLimitedChildren<T>(children: T[], limit?: number): T[] {
  return limit === undefined ? children : children.slice(0, limit);
}

function shouldShowSeeMore(childCount: number, limit?: number): boolean {
  return typeof limit === 'number' && childCount > limit;
}

function makeSeeMoreAction(node: CollectionTreeNode<CMDKActionData>): CMDKFlatItem {
  return {
    children: node.children,
    key: `${node.key}:see-more`,
    parent: node.parent,
    listItemType: 'action',
    limit: node.limit,
    keywords: node.keywords,
    display: {
      details: node.display.details,
      label: t('See all'),
    },
  };
}

function makeSectionAction(node: CollectionTreeNode<CMDKActionData>): CMDKFlatItem {
  return {
    ...node,
    key: `${node.key}:header`,
    listItemType: 'section',
  };
}

export function getSourceAction(
  action: CMDKFlatItem,
  actions: CMDKFlatItem[],
  prefixMap: Map<string, string[]>
): CMDKFlatItem {
  if (!isSeeMoreAction(action.key)) {
    return action;
  }

  const sourceActionKey = getSourceActionKey(action.key);
  const headerMatch = actions.find(
    candidate => candidate.key === `${sourceActionKey}:header`
  );
  if (headerMatch) {
    return headerMatch;
  }

  // For nested groups the original header was replaced by the root ancestor header.
  // The prefix map stores the group label under a distinct `:source-label` key.
  const groupLabel = prefixMap.get(`${action.key}:source-label`)?.[0];
  if (groupLabel) {
    return {...action, display: {...action.display, label: groupLabel}};
  }

  return action;
}

export function isSeeMoreAction(key: string): boolean {
  return key.endsWith(':see-more');
}

export function getSourceActionKey(key: string): string {
  return isSeeMoreAction(key) ? key.replace(/:see-more$/, '') : key;
}

function isEmptyResourceNode(node: CollectionTreeNode<CMDKActionData>): boolean {
  return (
    node.children.length === 0 &&
    'resource' in node &&
    !('to' in node) &&
    !('onAction' in node) &&
    !node.targetAction &&
    !('prompt' in node && node.prompt) &&
    !('textInput' in node && node.textInput)
  );
}

export function groupActionsBySection(actions: CMDKFlatItem[]): CMDKActionSection[] {
  const sections: CMDKActionSection[] = [];

  for (const action of actions) {
    if (action.listItemType === 'section') {
      sections.push({header: action, items: []});
      continue;
    }

    const currentSection = sections.at(-1);
    if (currentSection?.header === undefined) {
      const section = currentSection ?? {header: undefined, items: []};
      if (currentSection === undefined) {
        sections.push(section);
      }
      section.items.push(action);
      continue;
    }

    currentSection.items.push(action);
  }

  return sections;
}
