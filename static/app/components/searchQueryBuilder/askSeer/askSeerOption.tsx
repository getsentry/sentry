import {useRef, useState} from 'react';
import {useOption} from '@react-aria/listbox';
import type {ComboBoxState} from '@react-stately/combobox';

import {ExternalLink} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {
  AskSeerLabel,
  AskSeerListItem,
} from 'sentry/components/searchQueryBuilder/askSeer/components';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export const ASK_SEER_ITEM_KEY = 'ask_seer';

export function AskSeerOption<T>({state}: {state: ComboBoxState<T>}) {
  const ref = useRef<HTMLDivElement>(null);
  const {setDisplayAskSeer} = useSearchQueryBuilder();

  const organization = useOrganization();
  const hasAskSeerConsentFlowChanges = organization.features.includes(
    'ask-seer-consent-flow-update'
  );

  const [optionDisableOverride, setOptionDisableOverride] = useState(false);

  const {optionProps, labelProps, isFocused, isPressed} = useOption(
    {
      key: ASK_SEER_ITEM_KEY,
      'aria-label': 'Ask Seer to build your query',
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
      <Tooltip
        title={tct(
          'The assistant requires Generative AI which is subject to our [dataProcessingPolicy:data processing policy].',
          {
            dataProcessingPolicy: (
              <ExternalLink
                onMouseOver={() => setOptionDisableOverride(true)}
                onMouseOut={() => setOptionDisableOverride(false)}
                href="https://docs.sentry.io/product/security/ai-ml-policy/#use-of-identifying-data-for-generative-ai-features"
              />
            ),
          }
        )}
        isHoverable
        showUnderline={hasAskSeerConsentFlowChanges}
        disabled={!hasAskSeerConsentFlowChanges}
      >
        <AskSeerLabel {...labelProps}>
          {t('Ask Seer to build your query')} <FeatureBadge type="beta" />
        </AskSeerLabel>
      </Tooltip>
    </AskSeerListItem>
  );
}
