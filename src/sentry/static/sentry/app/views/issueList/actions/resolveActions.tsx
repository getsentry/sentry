import React from 'react';

import ResolveActions from 'app/components/actions/resolve';
import {Organization} from 'app/types';

import {ConfirmAction} from './utils';

type Props = {
  orgSlug: Organization['slug'];
  anySelected: boolean;
  params: any;
  onUpdate: (data?: any) => void;
  onShouldConfirm: (action: ConfirmAction) => boolean;
};

function ResolveActionsContainer({
  params,
  orgSlug,
  anySelected,
  onShouldConfirm,
  onUpdate,
}: Props) {
  const {
    hasReleases,
    latestRelease,
    projectId,
    confirm,
    label,
    loadingProjects,
    projectFetchError,
  } = params;

  // resolve requires a single project to be active in an org context
  // projectId is null when 0 or >1 projects are selected.
  const resolveDisabled = Boolean(!anySelected || projectFetchError);
  const resolveDropdownDisabled = Boolean(
    !anySelected || !projectId || loadingProjects || projectFetchError
  );

  return (
    <ResolveActions
      hasRelease={hasReleases}
      latestRelease={latestRelease}
      orgSlug={orgSlug}
      projectSlug={projectId}
      onUpdate={onUpdate}
      shouldConfirm={onShouldConfirm(ConfirmAction.RESOLVE)}
      confirmMessage={confirm('resolve', true)}
      confirmLabel={label('resolve')}
      disabled={resolveDisabled}
      disableDropdown={resolveDropdownDisabled}
      projectFetchError={projectFetchError}
    />
  );
}

export default ResolveActionsContainer;
