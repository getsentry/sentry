import ResolveActions from 'sentry/components/actions/resolve';
import useProjects from 'sentry/utils/useProjects';

import type {getConfirm, getLabel} from './utils';
import {ConfirmAction} from './utils';

type Props = {
  anySelected: boolean;
  confirm: ReturnType<typeof getConfirm>;
  label: ReturnType<typeof getLabel>;
  onShouldConfirm: (action: ConfirmAction) => boolean;
  onUpdate: (data?: any) => void;
  selectedProjectSlug: string | undefined;
};

function ResolveActionsContainer({
  anySelected,
  onShouldConfirm,
  onUpdate,
  selectedProjectSlug,
  confirm,
  label,
}: Props) {
  const {initiallyLoaded, projects, fetchError} = useProjects({
    slugs: selectedProjectSlug ? [selectedProjectSlug] : [],
  });

  const project = selectedProjectSlug
    ? projects.find(p => p.slug === selectedProjectSlug)
    : null;

  const hasRelease =
    project && 'features' in project ? project.features.includes('releases') : false;

  const latestRelease =
    project && 'latestRelease' in project ? project.latestRelease : undefined;

  // resolve requires a single project to be active in an org context
  // projectId is null when 0 or >1 projects are selected.
  const resolveDisabled = Boolean(!anySelected || fetchError);
  const resolveDropdownDisabled = Boolean(
    !anySelected || !project?.slug || !initiallyLoaded || fetchError
  );

  return (
    <ResolveActions
      hasRelease={hasRelease}
      multipleProjectsSelected={!selectedProjectSlug}
      latestRelease={latestRelease}
      projectSlug={project?.slug}
      onUpdate={onUpdate}
      shouldConfirm={onShouldConfirm(ConfirmAction.RESOLVE)}
      confirmMessage={confirm({action: ConfirmAction.RESOLVE, canBeUndone: true})}
      confirmLabel={label('resolve')}
      disabled={resolveDisabled}
      disableDropdown={resolveDropdownDisabled}
      projectFetchError={Boolean(fetchError)}
    />
  );
}

export default ResolveActionsContainer;
