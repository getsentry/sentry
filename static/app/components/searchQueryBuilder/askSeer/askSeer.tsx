import type {ComboBoxState} from '@react-stately/combobox';

import Feature from 'sentry/components/acl/feature';
import {makeOrganizationSeerSetupQueryKey} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {setupCheckQueryKey} from 'sentry/components/events/autofix/useSeerAcknowledgeMutation';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AskSeerConsentOption} from 'sentry/components/searchQueryBuilder/askSeer/askSeerConsentOption';
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
  const hasAskSeerConsentFlowChanges = organization.features.includes(
    'gen-ai-consent-flow-removal'
  );
  const {gaveSeerConsent, displayAskSeerFeedback} = useSearchQueryBuilder();

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

  if (gaveSeerConsent || hasAskSeerConsentFlowChanges) {
    return (
      <Feature features="organizations:gen-ai-explore-traces-consent-ui">
        <AskSeerPane>
          <AskSeerOption state={state} />
        </AskSeerPane>
      </Feature>
    );
  }

  return (
    <Feature features="organizations:gen-ai-explore-traces-consent-ui">
      <AskSeerPane>
        <AskSeerConsentOption state={state} />
      </AskSeerPane>
    </Feature>
  );
}
