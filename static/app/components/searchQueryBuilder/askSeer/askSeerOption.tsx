import {useRef, useState} from 'react';
import {useOption} from '@react-aria/listbox';
import type {ComboBoxState} from '@react-stately/combobox';

import {AiPrivacyTooltip} from 'sentry/components/aiPrivacyTooltip';
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
  const {setDisplayAskSeer, aiSearchBadgeType} = useSearchQueryBuilder();

  const organization = useOrganization();
  const hasAskSeerConsentFlowChanges = organization.features.includes(
    'gen-ai-consent-flow-removal'
  );

  const [optionDisableOverride, setOptionDisableOverride] = useState(false);

  const {optionProps, labelProps, isFocused, isPressed} = useOption(
    {
      key: ASK_SEER_ITEM_KEY,
      'aria-label': 'Ask AI to build your query',
      shouldFocusOnHover: true,
      shouldSelectOnPressUp: true,
      isDisabled: optionDisableOverride,
    },
    state,
    ref
  );

  const handleClick = () => {
    if (optionDisableOverride) return;

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
        <AiPrivacyTooltip
          linkProps={{
            onMouseOver: () => setOptionDisableOverride(true),
            onMouseOut: () => setOptionDisableOverride(false),
          }}
          showUnderline={hasAskSeerConsentFlowChanges}
          disabled={!hasAskSeerConsentFlowChanges}
        >
          {t('Ask AI to build your query')}
        </AiPrivacyTooltip>
        <FeatureBadge type={aiSearchBadgeType} />
      </AskSeerLabel>
    </AskSeerListItem>
  );
}
