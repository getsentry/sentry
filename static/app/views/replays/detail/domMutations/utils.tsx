import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import {Extraction} from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';

export type DomFilters = {
  [key: string]: (action: Extraction) => boolean;
};

export const getDomMutationsTypes = (actions: Extraction[]) =>
  Array.from(new Set<BreadcrumbType>(actions.map(mutation => mutation.crumb.type)));

export const getFilteredDomMutations = (
  actions: Extraction[],
  searchTerm: string,
  filters: DomFilters
) => {
  if (!searchTerm && Object.keys(filters).length === 0) {
    return actions;
  }
  return actions.filter(mutation => {
    const normalizedSearchTerm = searchTerm.toLowerCase();
    const doesMatch = mutation.html?.toLowerCase().includes(normalizedSearchTerm);

    for (const key in filters) {
      if (filters.hasOwnProperty(key)) {
        const filter = filters[key];
        if (!filter(mutation)) {
          return false;
        }
      }
    }

    return doesMatch;
  });
};
