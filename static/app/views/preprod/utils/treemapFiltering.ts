import type {TreemapElement} from 'sentry/views/preprod/types/appSizeTypes';

export function filterTreemapElement(
  element: TreemapElement,
  searchQuery: string
): TreemapElement | null {
  if (!searchQuery.trim()) {
    return element;
  }

  const query = searchQuery.toLowerCase();
  const matchesQuery = (name: string, path?: string) => {
    const nameMatch = name.toLowerCase().includes(query);
    const pathMatch = path?.toLowerCase().includes(query);
    return nameMatch || pathMatch;
  };

  // Check if current element matches
  const currentMatches = matchesQuery(element.name, element.path);

  // Filter children recursively
  const filteredChildren = element.children
    .map(child => filterTreemapElement(child, searchQuery))
    .filter((child): child is TreemapElement => child !== null);

  // If current element matches or has matching children, include it
  if (currentMatches || filteredChildren.length > 0) {
    return {
      ...element,
      children: filteredChildren,
    };
  }

  return null;
}
