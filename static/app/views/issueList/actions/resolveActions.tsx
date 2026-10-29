import {ResolveActions} from 'sentry/components/actions/resolve';
import {useProjects} from 'sentry/utils/useProjects';
import {useProjectReleaseVersionIsSemver} from 'sentry/views/issueDetails/useProjectReleaseVersionIsSemver';

import type {getConfirm, getLabel} from './utils';
import {ConfirmAction} from './utils';

type Props = {
  anySelected: boolean;
  confirm: ReturnType<typeof getConfirm>;
  label: ReturnType<typeof getLabel>;
  onShouldConfirm: (action: ConfirmAction) => boolean;
  onUpdate: (data?: any) => void;
  selectedProjectSlug: string | undefined;
  disabled?: boolean;
  disabledReason?: string;
};

export function ResolveActionsContainer({
  anySelected,
  onShouldConfirm,
  onUpdate,
  selectedProjectSlug,
  confirm,
  label,
  disabled,
  disabledReason,
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

  const projHasSemverRelease = useProjectReleaseVersionIsSemver({
    version: project?.latestRelease?.version,
    enabled: Boolean(project),
  });

  const hasSemverReleaseFeature = projHasSemverRelease;

  // resolve requires a single project to be active in an org context
  // projectId is null when 0 or >1 projects are selected.
  const resolveDisabled = Boolean(disabled || !anySelected || fetchError);
  const resolveDropdownDisabled = Boolean(
    resolveDisabled || !project?.slug || !initiallyLoaded
  );

  return (
    <ResolveActions
      hasRelease={hasRelease}
      multipleProjectsSelected={!selectedProjectSlug}
      latestRelease={latestRelease}
      project={project ?? undefined}
      onUpdate={onUpdate}
      shouldConfirm={onShouldConfirm(ConfirmAction.RESOLVE)}
      confirmMessage={confirm({action: ConfirmAction.RESOLVE, canBeUndone: true})}
      confirmLabel={label('resolve')}
      disabled={resolveDisabled}
      disabledReason={disabledReason}
      disableDropdown={resolveDropdownDisabled}
      projectFetchError={Boolean(fetchError)}
      hasSemverReleaseFeature={hasSemverReleaseFeature}
    />
  );
}
