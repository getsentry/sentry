import ResolveActions, {ResolveActionsProps} from 'sentry/components/actions/resolve';

import {ConfirmAction, getConfirm, getLabel} from './utils';

type Props = {
  anySelected: boolean;
  onShouldConfirm: (action: ConfirmAction) => boolean;
  onUpdate: (data?: any) => void;
  params: Pick<
    ResolveActionsProps,
    | 'disabled'
    | 'hasRelease'
    | 'latestRelease'
    | 'projectSlug'
    | 'projectFetchError'
    | 'multipleProjectsSelected'
  > & {
    confirm: ReturnType<typeof getConfirm>;
    label: ReturnType<typeof getLabel>;
    loadingProjects?: boolean;
  };
};

function ResolveActionsContainer({
  params,
  anySelected,
  onShouldConfirm,
  onUpdate,
}: Props) {
  const {
    hasRelease,
    multipleProjectsSelected,
    latestRelease,
    projectSlug,
    confirm,
    label,
    loadingProjects,
    projectFetchError,
  } = params;

  // resolve requires a single project to be active in an org context
  // projectId is null when 0 or >1 projects are selected.
  const resolveDisabled = Boolean(!anySelected || projectFetchError);
  const resolveDropdownDisabled = Boolean(
    !anySelected || !projectSlug || loadingProjects || projectFetchError
  );

  return (
    <ResolveActions
      hasRelease={hasRelease}
      multipleProjectsSelected={multipleProjectsSelected}
      latestRelease={latestRelease}
      projectSlug={projectSlug}
      onUpdate={onUpdate}
      shouldConfirm={onShouldConfirm(ConfirmAction.RESOLVE)}
      confirmMessage={confirm({action: ConfirmAction.RESOLVE, canBeUndone: true})}
      confirmLabel={label('resolve')}
      disabled={resolveDisabled}
      disableDropdown={resolveDropdownDisabled}
      projectFetchError={projectFetchError}
    />
  );
}

export default ResolveActionsContainer;
