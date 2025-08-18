import {createContext, useContext, type ReactNode} from 'react';

import usePageFilters from 'sentry/utils/usePageFilters';

export interface ProjectSelectionContextType {
  selectedProjects: number[];
}

const ProjectSelectionContext = createContext<ProjectSelectionContextType | undefined>(
  undefined
);

export function useProjectSelection() {
  const context = useContext(ProjectSelectionContext);
  if (!context) {
    throw new Error('useProjectSelection must be used within a ProjectSelectionProvider');
  }
  return context;
}

interface ProjectSelectionProviderProps {
  children: ReactNode;
}

export function ProjectSelectionProvider({children}: ProjectSelectionProviderProps) {
  const {selection} = usePageFilters();

  return (
    <ProjectSelectionContext.Provider value={{selectedProjects: selection.projects}}>
      {children}
    </ProjectSelectionContext.Provider>
  );
}
