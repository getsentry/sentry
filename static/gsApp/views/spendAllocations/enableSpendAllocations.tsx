import type {Dispatch} from 'react';

import {Flex} from '@sentry/scraps/layout';

import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';

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
      // Toggle option; TODO: make sure this is actually redundant before removing this
      await api.requestPromise(`/organizations/${orgSlug}/spend-allocations/toggle/`, {
        method: 'POST',
      });
      // Create root allocations
      await api.requestPromise(`/organizations/${orgSlug}/spend-allocations/index/`, {
        method: 'POST',
      });
    } catch (err: any) {
      if (err.status === 409) {
        setErrors('Spend Allocations are already enabled');
      }
    }
    await fetchSpendAllocations();
  };

  return (
    <Panel>
      <Flex
        direction="column"
        justify="center"
        align="center"
        padding="3xl"
        style={{minHeight: '200px', textAlign: 'center'}}
      >
        <p>{t('Enable the Spend Allocation feature for your organization')}</p>
        {hasScope && (
          <Button
            aria-label={t('Get started')}
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
      </Flex>
    </Panel>
  );
}

export default EnableSpendAllocations;
