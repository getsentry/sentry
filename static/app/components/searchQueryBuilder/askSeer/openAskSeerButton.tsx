import {Button} from '@sentry/scraps/button';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {
  useSearchQueryBuilderAI,
  useSearchQueryBuilderLayout,
} from 'sentry/components/searchQueryBuilder/context';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

export function OpenAskSeerButton() {
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();
  const {setAutoSubmitSeer, setDisplayAskSeer} = useSearchQueryBuilderAI();
  const {currentInputValueRef} = useSearchQueryBuilderLayout();

  return (
    <Button
      icon={<IconSeer />}
      size="zero"
      variant="primary"
      onClick={() => {
        trackAnalytics('ai_query.interface', {
          organization,
          area: analyticsArea,
          action: 'opened',
        });
        setAutoSubmitSeer(Boolean(currentInputValueRef.current.trim()));
        setDisplayAskSeer(true);
      }}
    >
      {t('Ask AI to build your query')}
    </Button>
  );
}
