import {useMemo} from 'react';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {useProjects} from 'sentry/utils/useProjects';

export function SelectProject({
  setProjectSlug,
  projectSlug,
}: {
  projectSlug: string | null | undefined;
  setProjectSlug: (projectSlug: string | null) => void;
}) {
  const {projects} = useProjects();

  const projectOptions = useMemo(
    () => projects.map(p => ({value: p.slug, label: p.slug})),
    [projects]
  );

  return (
    <CompactSelect
      clearable
      onChange={selected => setProjectSlug(selected?.value ?? null)}
      options={projectOptions}
      search
      size="xs"
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix="Project" />
      )}
      value={projectSlug ?? undefined}
    />
  );
}

export function SelectProjects({
  setProjectSlugs,
  projectSlugs,
}: {
  projectSlugs: string[];
  setProjectSlugs: (projectSlugs: string[]) => void;
}) {
  const {projects} = useProjects();

  const projectOptions = useMemo(
    () => projects.map(p => ({value: p.slug, label: p.slug})),
    [projects]
  );

  return (
    <CompactSelect
      clearable
      onChange={selected => setProjectSlugs(selected?.map(opt => opt.value) ?? [])}
      options={projectOptions}
      search
      size="xs"
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix="Projects" />
      )}
      value={projectSlugs ?? undefined}
      multiple
    />
  );
}
