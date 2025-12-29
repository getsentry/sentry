import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import type {Client} from 'sentry/api';
import {Badge} from 'sentry/components/core/badge';
import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import AlertStore from 'sentry/stores/alertStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

const POLICY_URL =
  'https://www.notion.so/sentry/Sentry-Rules-for-Handling-Customer-Data-9612532c37e14eeb943a6a584abbac99';

const SUPERUSER_MESSAGE = 'You are in superuser mode.';
const WARNING_MESSAGE = (
  <Fragment>
    Please refer to Sentry's{' '}
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
      size="sm"
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
        variant: 'danger',
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
    <StyledBadge type="warning" className={className}>
      <Tooltip
        isHoverable
        title={
          <TooltipContent>
            <Content>{WARNING_MESSAGE}</Content>
            <ExitSuperuserButton />
          </TooltipContent>
        }
      >
        Superuser
      </Tooltip>
    </StyledBadge>
  );
}

const StyledBadge = styled(Badge)`
  color: ${p => p.theme.white};
  background: ${p => p.theme.colors.chonk.red400};
`;

const TooltipContent = styled('div')`
  padding: ${space(0.5)} ${space(0.25)};
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  flex-direction: column;
  gap: ${space(1)};
  text-align: left;
`;

const Content = styled('p')`
  margin: 0;
`;

export default SuperuserWarning;
