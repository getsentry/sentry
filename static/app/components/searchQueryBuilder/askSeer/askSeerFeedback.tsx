import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {AskSeerLabel} from 'sentry/components/searchQueryBuilder/askSeer/components';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {IconSeer, IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

export function AskSeerFeedback() {
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();
  const {setDisplayAskSeerFeedback, askSeerNLQueryRef, askSeerSuggestedQueryRef} =
    useSearchQueryBuilder();

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
    setDisplayAskSeerFeedback(false);
  };

  return (
    <Fragment>
      <AskSeerLabel fontWeight="normal">
        <IconSeer />
        <Text variant="primary">{t('We loaded the results. Does this look right?')}</Text>
      </AskSeerLabel>
      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
        <Button
          size="zero"
          icon={<IconThumb />}
          onClick={() => handleClick('positive')}
          aria-label="Yep, correct results"
        >
          Yep
        </Button>
        <Button
          size="zero"
          icon={<IconThumb direction="down" />}
          onClick={() => handleClick('negative')}
          aria-label="Nope, incorrect results"
        >
          Nope
        </Button>
      </div>
    </Fragment>
  );
}
