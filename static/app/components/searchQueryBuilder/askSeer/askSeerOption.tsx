import {useRef} from 'react';
import {useOption} from '@react-aria/listbox';
import type {ComboBoxState} from '@react-stately/combobox';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {
  AskSeerLabel,
  AskSeerListItem,
} from 'sentry/components/searchQueryBuilder/askSeer/components';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export const ASK_SEER_ITEM_KEY = 'ask_seer';

export function AskSeerOption<T>({state}: {state: ComboBoxState<T>}) {
  const ref = useRef<HTMLDivElement>(null);
  const organization = useOrganization();
  const {setDisplayAskSeer} = useSearchQueryBuilder();

  const {optionProps, labelProps, isFocused, isPressed} = useOption(
    {
      key: ASK_SEER_ITEM_KEY,
      'aria-label': 'Ask Seer to build your query',
      shouldFocusOnHover: true,
      shouldSelectOnPressUp: true,
      isDisabled: false,
    },
    state,
    ref
  );

  const handleClick = () => {
    trackAnalytics('trace.explorer.ai_query_interface', {
      organization,
      action: 'opened',
    });
    setDisplayAskSeer(true);
  };

  return (
    <AskSeerListItem ref={ref} onClick={handleClick} {...optionProps}>
      <InteractionStateLayer isHovered={isFocused} isPressed={isPressed} />
      <IconSeer />
      <AskSeerLabel {...labelProps}>
        {t('Ask Seer to build your query')} <FeatureBadge type="beta" />
      </AskSeerLabel>
    </AskSeerListItem>
  );
}
