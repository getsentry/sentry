import {useRef, useState} from 'react';
import {useOption} from '@react-aria/listbox';
import type {ComboBoxState} from '@react-stately/combobox';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {useSeerAcknowledgeMutation} from 'sentry/components/events/autofix/useSeerAcknowledgeMutation';
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
  const organization = useOrganization();
  const {mutate: seerAcknowledgeMutate} = useSeerAcknowledgeMutation();
  const {setDisplayAskSeer, gaveSeerConsent} = useSearchQueryBuilder();

  const [optionDisableOverride, setOptionDisableOverride] = useState(false);

  const {optionProps, labelProps, isFocused, isPressed} = useOption(
    {
      key: ASK_SEER_ITEM_KEY,
      'aria-label': 'Ask Seer',
      shouldFocusOnHover: true,
      shouldSelectOnPressUp: true,
      isDisabled: optionDisableOverride,
    },
    state,
    ref
  );

  const handleClick = () => {
    if (optionDisableOverride) return;

    if (!gaveSeerConsent) {
      trackAnalytics('trace.explorer.ai_query_interface', {
        organization,
        action: 'consent_accepted',
      });
      seerAcknowledgeMutate();
      return;
    }

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
        showUnderline
      >
        <AskSeerLabel {...labelProps}>
          {t('Ask Seer')} <FeatureBadge type="beta" />
        </AskSeerLabel>
      </Tooltip>
    </AskSeerListItem>
  );
}
