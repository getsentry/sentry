import type {Dispatch} from 'react';
import styled from '@emotion/styled';

import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  api: Client;
  fetchSpendAllocations: () => Promise<void>;
  hasScope: boolean;
  orgSlug: string;
  setErrors: Dispatch<string | null>;
};

function EnableSpendAllocations({
  hasScope,
  fetchSpendAllocations,
  api,
  orgSlug,
  setErrors,
}: Props) {
  const enableAction = async () => {
    try {
      // Toggle feature flag
      await api.requestPromise(`/organizations/${orgSlug}/spend-allocations/toggle/`, {
        method: 'POST',
      });
      // Create root allocations
      await api.requestPromise(`/organizations/${orgSlug}/spend-allocations/index/`, {
        method: 'POST',
      });
    } catch (err) {
      if (err.status === 409) {
        setErrors('Spend Allocations are already enabled');
      }
    }
    await fetchSpendAllocations();
  };

  return (
    <EnablePanel>
      <p>{t('Enable the Spend Allocation feature for your organization')}</p>
      {hasScope && (
        <Button
          aria-label="Get started"
          priority="primary"
          size="sm"
          disabled={!hasScope}
          onClick={enableAction}
        >
          {t('Get Started')}
        </Button>
      )}
      {!hasScope && (
        <p>
          <strong>
            {t('Chat with your organization owner to enable spend allocations')}
          </strong>
        </p>
      )}
    </EnablePanel>
  );
}

export default EnableSpendAllocations;

const EnablePanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  padding: ${space(4)};
  text-align: center;
`;
