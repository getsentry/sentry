import {Fragment, useEffect} from 'react';

import type {Client} from 'sentry/api';
import {Badge} from 'sentry/components/core/badge';
import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/tooltip';
import AlertStore from 'sentry/stores/alertStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

const POLICY_URL =
  'https://www.notion.so/sentry/Sentry-Rules-for-Handling-Customer-Data-9612532c37e14eeb943a6a584abbac99';

const SUPERUSER_MESSAGE = 'You are in superuser mode.';
const WARNING_MESSAGE = (
  <Fragment>
    Please be familiar with the{' '}
    <a href={POLICY_URL} target="_none">
      rules for handling customer data
    </a>
    . Misuse of superuser will result in an unpleasant coffee chat with Legal, Security,
    and HR.
  </Fragment>
);

export function shouldExcludeOrg(organization?: Organization | null) {
  return organization?.slug === 'demo';
}

function handleExitSuperuser(api: Client) {
  api
    .requestPromise('/staff-auth/', {
      method: 'DELETE',
    })
    .then(() => window.location.reload());
}

function ExitSuperuserButton() {
  const api = useApi({persistInFlight: true});
  return (
    <Button
      style={{
        top: space(0.5),
        bottom: space(0.75),
      }}
      size="xs"
      priority="primary"
      onClick={() => {
        handleExitSuperuser(api);
      }}
    >
      Exit Superuser Mode
    </Button>
  );
}

type Props = {
  className?: string;
  organization?: Organization;
};

function SuperuserWarning({organization, className}: Props) {
  const isExcludedOrg = shouldExcludeOrg(organization);

  useEffect(() => {
    if (!isExcludedOrg) {
      AlertStore.addAlert({
        id: 'superuser-warning',
        message: (
          <Fragment>
            {SUPERUSER_MESSAGE} {WARNING_MESSAGE}
          </Fragment>
        ),
        type: 'error',
        opaque: true,
        neverExpire: true,
        noDuplicates: true,
      });
    }
  }, [isExcludedOrg]);

  if (isExcludedOrg) {
    return null;
  }

  return (
    <Badge type="warning" className={className}>
      <Tooltip
        isHoverable
        title={
          <Fragment>
            <ExitSuperuserButton />
            <br />
            <br />
            {WARNING_MESSAGE}
          </Fragment>
        }
      >
        Superuser
      </Tooltip>
    </Badge>
  );
}

export default SuperuserWarning;
