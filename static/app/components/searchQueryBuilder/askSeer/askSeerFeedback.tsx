import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {AskSeerLabel} from 'sentry/components/searchQueryBuilder/askSeer/components';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {IconSeer, IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export function AskSeerFeedback() {
  const organization = useOrganization();
  const {setDisplayAskSeerFeedback, askSeerNLQueryRef, askSeerSuggestedQueryRef} =
    useSearchQueryBuilder();

  const handleClick = (correct: 'yes' | 'no') => {
    trackAnalytics('trace.explorer.ai_query_feedback', {
      organization,
      correct_query_results: correct,
      natural_language_query: askSeerNLQueryRef.current ?? '',
      query: askSeerSuggestedQueryRef.current ?? '',
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
          onClick={() => handleClick('yes')}
          aria-label="Yep, correct results"
        >
          Yep
        </Button>
        <Button
          size="zero"
          icon={<IconThumb direction="down" />}
          onClick={() => handleClick('no')}
          aria-label="Nope, incorrect results"
        >
          Nope
        </Button>
      </div>
    </Fragment>
  );
}
