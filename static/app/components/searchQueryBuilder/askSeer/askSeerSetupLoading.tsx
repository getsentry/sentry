import {useIsFetching, useIsMutating} from '@tanstack/react-query';

import {makeOrganizationSeerSetupQueryKey} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {setupCheckQueryKey} from 'sentry/components/events/autofix/useSeerAcknowledgeMutation';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {
  AskSeerLabel,
  AskSeerListItem,
  AskSeerPane,
} from 'sentry/components/searchQueryBuilder/askSeer/components';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function AskSeerSetupLoading() {
  const organization = useOrganization();

  const isMutating = useIsMutating({
    mutationKey: [setupCheckQueryKey(organization.slug)],
  });

  const isPendingSetupCheck =
    useIsFetching({
      queryKey: makeOrganizationSeerSetupQueryKey(organization.slug),
    }) > 0;

  const loadingState = Boolean(isPendingSetupCheck || isMutating);

  if (loadingState) {
    return (
      <AskSeerPane>
        <AskSeerListItem>
          <AskSeerLabel width="auto">{t('Loading Seer')}</AskSeerLabel>
          <LoadingIndicator size={16} style={{margin: 0}} />
        </AskSeerListItem>
      </AskSeerPane>
    );
  }

  return null;
}
