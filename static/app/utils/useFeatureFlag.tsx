import {Fragment, useMemo} from 'react';

import useOrganization from './useOrganization';
import usePageFilters from './usePageFilters';
import useProjects from './useProjects';

interface FeatureComponentProps {
  children: React.ReactNode | undefined;
  fallback?: React.ReactNode;
}

function makeFeatureComponent(isEnabled: boolean) {
  return function Feature({children, fallback}: FeatureComponentProps) {
    if (!isEnabled) {
      return fallback || null;
    }

    return <Fragment>{children}</Fragment>;
  };
}

export function useOrganizationFeatureFlag(feature: string) {
  const {features} = useOrganization();
  const isEnabled = features.includes(feature);
  const FeatureComponent = useMemo(() => makeFeatureComponent(isEnabled), [isEnabled]);
  return [isEnabled, FeatureComponent];
}

export function useProjectFeatureFlag(feature: string) {
  const {
    selection: {projects: selectedProjectIds},
  } = usePageFilters();

  const {projects} = useProjects();

  const selectedProjects = useMemo(
    () => projects.filter(p => selectedProjectIds.includes(Number(p.id))),
    [projects, selectedProjectIds]
  );

  const isEnabled = useMemo(
    () => selectedProjects.every(p => p.features.includes(feature)),
    [feature, selectedProjects]
  );

  const FeatureComponent = useMemo(() => makeFeatureComponent(isEnabled), [isEnabled]);

  return [isEnabled, FeatureComponent];
}
