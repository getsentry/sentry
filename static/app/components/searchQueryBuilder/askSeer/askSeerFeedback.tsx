import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {AskSeerLabel} from 'sentry/components/searchQueryBuilder/askSeer/components';
import {useSearchQueryBuilderAI} from 'sentry/components/searchQueryBuilder/context';
import {IconSeer, IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

export function AskSeerFeedback() {
  const organization = useOrganization();
  const hasAskSeerUxRework = organization.features.includes('gen-ai-ask-seer-ux-rework');
  const analyticsArea = useAnalyticsArea();
  const {setDisplayAskSeerFeedback, askSeerNLQueryRef, askSeerSuggestedQueryRef} =
    useSearchQueryBuilderAI();

  const handleClick = (type: 'positive' | 'negative') => {
    trackAnalytics('ai_query.feedback', {
      organization,
      area: analyticsArea,
      type,
      natural_language_query: askSeerNLQueryRef.current ?? '',
      suggested_query: askSeerSuggestedQueryRef.current ?? '',
    });
    askSeerNLQueryRef.current = null;
    askSeerSuggestedQueryRef.current = null;
    if (hasAskSeerUxRework) {
      addSuccessMessage(t('Thanks for the feedback!'));
    }
    setDisplayAskSeerFeedback(false);
  };

  return (
    <Flex
      align="center"
      justify={hasAskSeerUxRework ? undefined : 'between'}
      gap="md"
      flex={hasAskSeerUxRework ? undefined : '1'}
    >
      <AskSeerLabel fontWeight="normal">
        {hasAskSeerUxRework ? null : <IconSeer />}
        {hasAskSeerUxRework ? (
          <Text variant="primary">{t('How did we do?')}</Text>
        ) : (
          <Text variant="primary">
            {t('We loaded the results. Does this look right?')}
          </Text>
        )}
      </AskSeerLabel>

      <Flex align="center" gap="sm">
        <Button
          size="zero"
          icon={<IconThumb />}
          onClick={() => handleClick('positive')}
          aria-label="Yep, correct results"
        >
          {hasAskSeerUxRework ? null : t('Yep')}
        </Button>
        <Button
          size="zero"
          icon={<IconThumb direction="down" />}
          onClick={() => handleClick('negative')}
          aria-label="Nope, incorrect results"
        >
          {hasAskSeerUxRework ? null : t('No')}
        </Button>
      </Flex>
    </Flex>
  );
}
