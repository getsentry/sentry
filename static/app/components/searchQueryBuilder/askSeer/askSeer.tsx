import {useEffect} from 'react';
import type {ComboBoxState} from '@react-stately/combobox';

import Feature from 'sentry/components/acl/feature';
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
import usePrevious from 'sentry/utils/usePrevious';

export function AskSeer<T>({state}: {state: ComboBoxState<T>}) {
  const organization = useOrganization();
  const {gaveSeerConsent, displayAskSeerFeedback, setDisplayAskSeer, displayAskSeer} =
    useSearchQueryBuilder();
  const previousGaveSeerConsent = usePrevious(gaveSeerConsent);

  const isMutating = useIsMutating({
    mutationKey: [setupCheckQueryKey(organization.slug)],
  });
  const isPendingSetupCheck =
    useIsFetching({
      queryKey: makeOrganizationSeerSetupQueryKey(organization.slug),
    }) > 0;
  const loadingState = Boolean(isPendingSetupCheck || isMutating);

  useEffect(() => {
    if (
      !displayAskSeer &&
      previousGaveSeerConsent === false &&
      gaveSeerConsent === true &&
      !loadingState
    ) {
      setDisplayAskSeer(true);
    }
  }, [
    displayAskSeer,
    gaveSeerConsent,
    loadingState,
    previousGaveSeerConsent,
    setDisplayAskSeer,
  ]);

  if (loadingState) {
    return (
      <Feature features="organizations:gen-ai-explore-traces-consent-ui">
        <AskSeerPane>
          <AskSeerListItem>
            <AskSeerLabel width="auto">{t('Loading Seer')}</AskSeerLabel>
            <LoadingIndicator size={16} style={{margin: 0}} />
          </AskSeerListItem>
        </AskSeerPane>
      </Feature>
    );
  }

  if (displayAskSeerFeedback) {
    return (
      <Feature features="organizations:gen-ai-explore-traces-consent-ui">
        <AskSeerPane>
          <AskSeerListItem justifyContent="space-between" cursor="auto">
            <AskSeerFeedback />
          </AskSeerListItem>
        </AskSeerPane>
      </Feature>
    );
  }

  return (
    <AskSeerPane>
      <AskSeerOption state={state} />
    </AskSeerPane>
  );
}
