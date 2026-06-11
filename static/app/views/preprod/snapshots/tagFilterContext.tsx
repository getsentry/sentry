import {createContext, useContext} from 'react';

interface TagFilterContextValue {
  activeTagFilters: Record<string, string>;
  onToggleTagFilter: (key: string, value: string) => void;
}

const TagFilterContext = createContext<TagFilterContextValue | null>(null);

export const TagFilterProvider = TagFilterContext.Provider;

export function useTagFilters(): TagFilterContextValue | null {
  return useContext(TagFilterContext);
}
