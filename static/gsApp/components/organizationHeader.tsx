import {Fragment} from 'react';

import type {Organization} from 'sentry/types/organization';

import GSBanner from 'getsentry/components/gsBanner';
import useReplayInit from 'getsentry/utils/useReplayInit';

interface Props {
  organization: Organization;
}

export function OrganizationHeader({organization}: Props) {
  useReplayInit();

  return (
    <Fragment>
      <GSBanner organization={organization} />
    </Fragment>
  );
}
