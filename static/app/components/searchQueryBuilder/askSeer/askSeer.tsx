import type {ComboBoxState} from '@react-stately/combobox';

import {makeOrganizationSeerSetupQueryKey} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {setupCheckQueryKey} from 'sentry/components/events/autofix/useSeerAcknowledgeMutation';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AskSeerFeedback} from 'sentry/components/searchQueryBuilder/askSeer/askSeerFeedback';
import {AskSeerOption} from 'sentry/components/searchQueryBuilder/askSeer/askSeerOption';
import {
  AskSeerLabel,
  AskSeerListItem,
  AskSeerPane,
} from 'sentry/components/searchQueryBuilder/askSeer/components';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {useIsFetching, useIsMutating} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function AskSeer<T>({state}: {state: ComboBoxState<T>}) {
  const organization = useOrganization();

  const {displayAskSeerFeedback} = useSearchQueryBuilder();

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

  if (displayAskSeerFeedback) {
    return (
      <AskSeerPane>
        <AskSeerListItem justifyContent="space-between" cursor="auto">
          <AskSeerFeedback />
        </AskSeerListItem>
      </AskSeerPane>
    );
  }

  return (
    <AskSeerPane>
      <AskSeerOption state={state} />
    </AskSeerPane>
  );
}
