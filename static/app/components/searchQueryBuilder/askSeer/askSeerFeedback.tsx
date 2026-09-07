import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {AskSeerLabel} from 'sentry/components/searchQueryBuilder/askSeer/components';
import {useSearchQueryBuilderAI} from 'sentry/components/searchQueryBuilder/context';
import {IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

export function AskSeerFeedback() {
  const organization = useOrganization();
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
    addSuccessMessage(t('Thanks for the feedback!'));
    setDisplayAskSeerFeedback(false);
  };

  return (
    <Flex align="center" gap="md">
      <AskSeerLabel fontWeight="normal">
        <Text variant="primary">{t('How did we do?')}</Text>
      </AskSeerLabel>

      <Flex align="center" gap="sm">
        <Button
          size="zero"
          icon={<IconThumb />}
          onClick={() => handleClick('positive')}
          aria-label="Yep, correct results"
        />
        <Button
          size="zero"
          icon={<IconThumb direction="down" />}
          onClick={() => handleClick('negative')}
          aria-label="Nope, incorrect results"
        />
      </Flex>
    </Flex>
  );
}
