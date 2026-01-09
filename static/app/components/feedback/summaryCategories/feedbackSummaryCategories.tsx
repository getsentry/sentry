import styled from '@emotion/styled';

import {AiPrivacyTooltip} from 'sentry/components/aiPrivacyTooltip';
import {Disclosure} from 'sentry/components/core/disclosure';
import {Flex, Stack} from 'sentry/components/core/layout';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import FeedbackCategories from 'sentry/components/feedback/summaryCategories/feedbackCategories';
import FeedbackSummary from 'sentry/components/feedback/summaryCategories/feedbackSummary';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

export default function FeedbackSummaryCategories() {
  const organization = useOrganization();

  const {areAiFeaturesAllowed} = useOrganizationSeerSetup();

  const [isExpanded, setIsExpanded] = useSyncedLocalStorageState(
    'user-feedback-ai-summary-categories-expanded',
    true
  );

  const showSummaryCategories =
    (organization.features.includes('user-feedback-ai-summaries') ||
      organization.features.includes('user-feedback-ai-categorization-features')) &&
    areAiFeaturesAllowed;

  if (!showSummaryCategories) {
    return null;
  }

  const feedbackButton = ({type}: {type: 'positive' | 'negative'}) => {
    return (
      <FeedbackButton
        aria-label={t('Give feedback on the AI-powered summary')}
        icon={<IconThumb direction={type === 'positive' ? 'up' : 'down'} />}
        title={type === 'positive' ? t('I like this') : t(`I don't like this`)}
        size="xs"
        feedbackOptions={{
          messagePlaceholder:
            type === 'positive'
              ? t('What did you like about the AI-powered summary?')
              : t('How can we make the summary work better for you?'),
          tags: {
            ['feedback.source']: 'feedback_ai_summary',
            ['feedback.owner']: 'replay',
            ['feedback.type']: type,
          },
        }}
      >
        {undefined}
      </FeedbackButton>
    );
  };

  return (
    <SummaryIconContainer>
      <Disclosure
        expanded={isExpanded}
        onExpandedChange={setIsExpanded}
        size="md"
        as="section"
      >
        <Disclosure.Title
          trailingItems={
            <Flex gap="xs">
              {feedbackButton({type: 'positive'})}
              {feedbackButton({type: 'negative'})}
            </Flex>
          }
        >
          <AiPrivacyTooltip>{t('Summary')}</AiPrivacyTooltip>
        </Disclosure.Title>
        <Disclosure.Content>
          <Stack gap="md" width="100%">
            {organization.features.includes('user-feedback-ai-summaries') && (
              <FeedbackSummary />
            )}
            {organization.features.includes(
              'user-feedback-ai-categorization-features'
            ) && <FeedbackCategories />}
          </Stack>
        </Disclosure.Content>
      </Disclosure>
    </SummaryIconContainer>
  );
}

const SummaryIconContainer = styled('div')`
  padding: ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;
