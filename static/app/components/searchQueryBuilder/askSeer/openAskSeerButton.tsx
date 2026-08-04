import type {KeyboardEvent, Ref} from 'react';

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

type OpenAskSeerButtonProps = {
  onTabForward: () => void;
  ref?: Ref<HTMLButtonElement>;
};

export function OpenAskSeerButton({onTabForward, ref}: OpenAskSeerButtonProps) {
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();
  const {setAutoSubmitSeer, setDisplayAskSeer} = useSearchQueryBuilderAI();
  const {actionBarRef, currentInputValueRef} = useSearchQueryBuilderLayout();

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key.startsWith('Arrow')) {
      event.stopPropagation();
      return;
    }

    if (event.key !== 'Tab' || event.shiftKey) {
      return;
    }

    const nextAction = actionBarRef.current?.querySelector('button');
    if (!(nextAction instanceof HTMLButtonElement)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onTabForward();
    nextAction.focus();
  }

  return (
    <Button
      icon={<IconSeer />}
      size="zero"
      variant="primary"
      ref={ref}
      onFocus={event => event.stopPropagation()}
      onKeyDown={handleKeyDown}
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
