import type {Heading, Nodes, Root} from 'mdast';

import {slugify} from '../static/app/utils/slugify.ts';

interface IndexedHeading {
  id: string;
  parents: string[];
  title: string;
}

// Only index headings in the document flow, not examples rendered inside JSX
// components (including aliased Demo components) or conditional expressions.
function collectHeadings(node: Nodes): Heading[] {
  if (node.type === 'heading') {
    return [node];
  }
  if (
    node.type === 'root' ||
    node.type === 'blockquote' ||
    node.type === 'listItem' ||
    node.type === 'list'
  ) {
    return node.children.flatMap(collectHeadings);
  }
  return [];
}

function headingText(node: Nodes): string | undefined {
  switch (node.type) {
    case 'text':
    case 'inlineCode':
      return node.value;
    case 'heading':
    case 'emphasis':
    case 'strong':
    case 'delete':
    case 'link':
    case 'linkReference': {
      const parts = node.children.map(headingText);
      return parts.every(part => part !== undefined) ? parts.join('') : undefined;
    }
    default:
      // Dynamic MDX cannot be indexed without evaluating the page. Leave it to
      // StoryHeading's runtime fallback instead of publishing a broken link.
      return undefined;
  }
}

/** Assign the same IDs to the search index and the compiled MDX headings. */
export function indexStoryHeadings(tree: Root): IndexedHeading[] {
  const headings = collectHeadings(tree).flatMap(node => {
    const title = headingText(node);
    if (!title) {
      return [];
    }
    const explicitId = node.data?.hProperties?.id;
    const baseId = typeof explicitId === 'string' ? explicitId : slugify(title);
    return baseId ? [{node, title, baseId}] : [];
  });
  const counts = new Map<string, number>();
  for (const {baseId} of headings) {
    counts.set(baseId, (counts.get(baseId) ?? 0) + 1);
  }

  // Reserve unique IDs so a generated parent prefix or numeric suffix cannot
  // steal an existing fragment (e.g. Details, Details, Details-2).
  const reserved = new Set(
    headings.filter(h => counts.get(h.baseId) === 1).map(h => h.baseId)
  );
  const used = new Set<string>();
  const parents: Array<{id: string; level: number; title: string}> = [];

  return headings.map(({node, title, baseId}) => {
    const level = Math.min(node.depth + 1, 6);
    while (parents.at(-1) && parents.at(-1)!.level >= level) {
      parents.pop();
    }
    const parent = parents.at(-1);
    const repeated = counts.get(baseId)! > 1;
    const scopedId = repeated && parent ? `${parent.id}-${baseId}` : baseId;
    let id = scopedId;
    let suffix = 2;
    while (used.has(id) || (repeated && reserved.has(id))) {
      id = `${scopedId}-${suffix++}`;
    }
    used.add(id);
    node.data = {...node.data, hProperties: {...node.data?.hProperties, id}};
    const entry = {id, title, parents: parents.map(p => p.title)};
    parents.push({id, title, level});
    return entry;
  });
}

export function remarkStoryHeadings() {
  return (tree: Root) => {
    indexStoryHeadings(tree);
  };
}
