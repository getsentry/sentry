import type {TreemapElement} from 'sentry/views/preprod/types/appSizeTypes';

export function filterTreemapElement(
  element: TreemapElement,
  searchQuery: string,
  parentPath = ''
): TreemapElement | null {
  if (!searchQuery.trim()) {
    return element;
  }

  // Special case: if this is the root element (no parent path), filter children first
  // and only return the root if there are matching children
  if (parentPath === '') {
    const filteredChildren = element.children
      .map(child => filterTreemapElement(child, searchQuery, element.name))
      .filter((child): child is TreemapElement => child !== null);

    if (filteredChildren.length === 0) {
      return null;
    }

    return {
      ...element,
      children: filteredChildren,
    };
  }

  const currentPath = `${parentPath}/${element.name}`;

  // Check if current element matches using enhanced search
  const currentMatches = nodeNameMatchesSearchTerm(element.name, parentPath, searchQuery);

  // Check if current element directly matches (not just path match)
  const currentDirectlyMatches = nodeNameDirectlyMatches(element.name, searchQuery);

  // Check if this is an exact match search (double backticks)
  const isExactSearch = searchQuery.startsWith('`') && searchQuery.endsWith('`');

  if (currentMatches) {
    if (isExactSearch) {
      // For exact searches, only include matching children
      const filteredChildren = element.children
        .map(child => filterTreemapElement(child, searchQuery, currentPath))
        .filter((child): child is TreemapElement => child !== null);

      return {
        ...element,
        children: filteredChildren,
      };
    }

    if (currentDirectlyMatches) {
      // For regular searches where the node name directly matches, we have special logic:
      // App containers (like .app, .framework, .bundle) should filter their children
      // to avoid showing unrelated content when the app name matches the search term.
      // Regular folders should include all children as before.
      const nodeName = element.name.toLowerCase();
      const isAppContainer =
        nodeName.endsWith('.app') ||
        nodeName.endsWith('.framework') ||
        nodeName.endsWith('.bundle') ||
        nodeName.endsWith('.plugin');

      if (isAppContainer) {
        // App containers: filter children recursively to avoid showing unrelated content
        const filteredChildren = element.children
          .map(child => filterTreemapElement(child, searchQuery, currentPath))
          .filter((child): child is TreemapElement => child !== null);

        return {
          ...element,
          children: filteredChildren,
        };
      }
      // Regular folders: include all children (traditional behavior)
      return {
        ...element,
        children: [...element.children],
      };
    }

    // For intermediate path matches, filter children recursively
    const filteredChildren = element.children
      .map(child => filterTreemapElement(child, searchQuery, currentPath))
      .filter((child): child is TreemapElement => child !== null);

    return {
      ...element,
      children: filteredChildren,
    };
  }

  // If current element doesn't match, filter children recursively
  const filteredChildren = element.children
    .map(child => filterTreemapElement(child, searchQuery, currentPath))
    .filter((child): child is TreemapElement => child !== null);

  // Include element if it has matching children
  if (filteredChildren.length > 0) {
    return {
      ...element,
      children: filteredChildren,
    };
  }

  return null;
}

/**
 * Checks if a node name matches the search term with enhanced features like
 * backtick escaping and path-based searching.
 */
export function nodeNameMatchesSearchTerm(
  nodeName: string,
  parentPath: string,
  searchTerm: string | null | undefined
): boolean {
  if (!searchTerm) {
    return true;
  }

  let actualSearchTerm = searchTerm;

  // Handle backtick escaping - just removes backticks like the original code
  if (searchTerm.startsWith('`') && searchTerm.endsWith('`')) {
    actualSearchTerm = searchTerm.substring(1, searchTerm.length - 1);
  } else if (searchTerm.startsWith('`')) {
    actualSearchTerm = searchTerm.substring(1);
  }

  if (!actualSearchTerm.includes('/')) {
    // Non-path search - only match if the node name itself contains the search term
    return nodeName.toLowerCase().includes(actualSearchTerm.toLowerCase());
  }

  // Path search - search across the full path
  const searchTermParts = actualSearchTerm.split('/');
  const fullPath = `${parentPath}/${nodeName}`.toLowerCase();
  const pathItems = fullPath.split('/');

  let pathStart = 0;
  let matchCount = 0;

  for (const searchPart of searchTermParts) {
    for (let j = pathStart; j < pathItems.length; j++) {
      if (pathItems[j].includes(searchPart.toLowerCase())) {
        pathStart = j + 1;
        matchCount += 1;
        break;
      }
    }
  }

  return matchCount === searchTermParts.length;
}

/**
 * Checks if a node name directly matches the search term (not just in its path).
 * Used to distinguish between direct matches vs intermediate path matches.
 */
export function nodeNameDirectlyMatches(nodeName: string, searchTerm: string): boolean {
  let actualSearchTerm = searchTerm;

  // Handle backtick escaping
  if (searchTerm.startsWith('`') && searchTerm.endsWith('`')) {
    actualSearchTerm = searchTerm.substring(1, searchTerm.length - 1);
  } else if (searchTerm.startsWith('`')) {
    actualSearchTerm = searchTerm.substring(1);
  }

  // For direct matching, ignore path parts and just check the node name
  if (actualSearchTerm.includes('/')) {
    const lastPart = actualSearchTerm.split('/').pop() || '';
    return nodeName.toLowerCase().includes(lastPart.toLowerCase());
  }

  return nodeName.toLowerCase().includes(actualSearchTerm.toLowerCase());
}
