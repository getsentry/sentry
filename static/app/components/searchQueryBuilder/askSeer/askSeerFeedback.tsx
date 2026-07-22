import {useEffect, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

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

  const [displayThankYou, setDisplayThankYou] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (displayThankYou) {
      timeout = setTimeout(() => {
        setDisplayThankYou(false);
        setDisplayAskSeerFeedback(false);
      }, 2000);
    }

    return () => clearTimeout(timeout);
  }, [displayThankYou, setDisplayAskSeerFeedback]);

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
      setDisplayThankYou(true);
    } else {
      setDisplayAskSeerFeedback(false);
    }
  };

  return (
    <Flex
      align="center"
      justify={hasAskSeerUxRework ? undefined : 'between'}
      gap="md"
      flex="1"
    >
      <AskSeerLabel fontWeight="normal">
        {hasAskSeerUxRework ? null : <IconSeer />}
        <AskSeerFeedbackLabel displayThankYou={displayThankYou} />
      </AskSeerLabel>

      {displayThankYou ? null : (
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
      )}
    </Flex>
  );
}

function AskSeerFeedbackLabel({displayThankYou}: {displayThankYou: boolean}) {
  const organization = useOrganization();
  const hasAskSeerUxRework = organization.features.includes('gen-ai-ask-seer-ux-rework');

  if (hasAskSeerUxRework && displayThankYou) {
    return <Text variant="primary">{t('Thanks for the feedback!')}</Text>;
  }

  if (hasAskSeerUxRework && !displayThankYou) {
    return <Text variant="primary">{t('How did we do?')}</Text>;
  }

  return (
    <Text variant="primary">{t('We loaded the results. Does this look right?')}</Text>
  );
}
