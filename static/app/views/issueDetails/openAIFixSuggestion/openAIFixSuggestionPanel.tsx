import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import {feedbackClient} from 'sentry/components/featureFeedback/feedbackModal';
import {Panel, PanelBody, PanelFooter, PanelHeader} from 'sentry/components/panels';
import {IconHappy, IconMeh, IconSad} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {
  experimentalFeatureTooltipDesc,
  openAISuggestionLocalStorageKey,
} from 'sentry/views/issueDetails/openAIFixSuggestion/utils';

enum OpenAISatisfactoryLevel {
  HELPED = 'helped',
  PARTIALLY_HELPED = 'partially_helped',
  DID_NOT_HELP = 'did_not_help',
}

const openAIFeedback = {
  [OpenAISatisfactoryLevel.HELPED]: t('It helped me solve the issue'),
  [OpenAISatisfactoryLevel.PARTIALLY_HELPED]: t('It partially helped me solve the issue'),
  [OpenAISatisfactoryLevel.DID_NOT_HELP]: t('It did not help me solve the issue'),
};

export function OpenAIFixSuggestionPanel() {
  const user = ConfigStore.get('user');
  const organization = useOrganization();
  const router = useRouter();
  const [openSuggestedFix, setOpenSuggestedFix] = useState(false);
  const hasSignedDPA = false;

  useEffect(() => {
    setOpenSuggestedFix(!!router.location.query.openSuggestedFix);
  }, [router.location.query]);

  const handleOpenAISuggestionFeedback = useCallback(
    (openAISatisfactoryLevel: OpenAISatisfactoryLevel) => {
      feedbackClient.captureEvent({
        request: {
          url: window.location.href, // gives the full url (origin + pathname)
        },
        tags: {
          featureName: 'openai-suggestion',
        },
        user,
        level: 'info',
        message: `OpenAI Suggestion Feedback - ${openAIFeedback[openAISatisfactoryLevel]}`,
      });

      addSuccessMessage('Thank you for your feedback!');

      setOpenSuggestedFix(false);
    },
    [user]
  );

  // const {
  //   data,
  //   isLoading: dataIsLoading,
  //   isError: dataIsError,
  //   refetch: dataRefetch,
  // } = useQuery<{suggestion: string}>(
  //   [`/projects/${organization.slug}/${projectSlug}/events/${eventID}/ai-fix-suggest/`],
  //   {
  //     staleTime: Infinity,
  //     enabled:
  //       (hasSignedDPA || localStorageState.agreedForwardDataToOpenAI) && suggestionOpen,
  //   }
  // );

  if (!organization.features.includes('open-ai-suggestion')) {
    return null;
  }

  if (!openSuggestedFix) {
    return null;
  }

  return (
    <FixSuggestionPanel>
      <PanelHeader>
        <div>
          {t('Suggested Fix')}
          <FeatureBadge type="experimental" title={experimentalFeatureTooltipDesc} />
        </div>
      </PanelHeader>
      <PanelBody withPadding>oioioi</PanelBody>
      <PanelFooter>
        <Feedback>
          <strong>{t('Was this helpful?')}</strong>
          <div>
            <Button
              title={openAIFeedback[OpenAISatisfactoryLevel.DID_NOT_HELP]}
              aria-label={openAIFeedback[OpenAISatisfactoryLevel.DID_NOT_HELP]}
              icon={<IconSad color="red300" />}
              size="xs"
              borderless
              onClick={() =>
                handleOpenAISuggestionFeedback(OpenAISatisfactoryLevel.DID_NOT_HELP)
              }
            />
            <Button
              title={openAIFeedback[OpenAISatisfactoryLevel.PARTIALLY_HELPED]}
              aria-label={openAIFeedback[OpenAISatisfactoryLevel.PARTIALLY_HELPED]}
              icon={<IconMeh color="yellow300" />}
              size="xs"
              borderless
              onClick={() =>
                handleOpenAISuggestionFeedback(OpenAISatisfactoryLevel.PARTIALLY_HELPED)
              }
            />
            <Button
              title={openAIFeedback[OpenAISatisfactoryLevel.HELPED]}
              aria-label={openAIFeedback[OpenAISatisfactoryLevel.HELPED]}
              icon={<IconHappy color="green300" />}
              size="xs"
              borderless
              onClick={() =>
                handleOpenAISuggestionFeedback(OpenAISatisfactoryLevel.HELPED)
              }
            />
          </div>
        </Feedback>
      </PanelFooter>
    </FixSuggestionPanel>
  );
}

const FixSuggestionPanel = styled(Panel)`
  margin-top: ${space(1.5)};
  margin-bottom: 0;
`;

const Feedback = styled('div')`
  padding: ${space(1)} ${space(2)};
  display: grid;
  grid-template-columns: 1fr max-content max-content max-content;
  align-items: center;
  text-align: right;
  gap: ${space(1)};
`;
