import {useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useOption} from '@react-aria/listbox';
import type {ComboBoxState} from '@react-stately/combobox';

import {Flex} from '@sentry/scraps/layout';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import ExternalLink from 'sentry/components/links/externalLink';
import {
  AskSeerLabel,
  AskSeerListItem,
} from 'sentry/components/searchQueryBuilder/askSeer/components';
import {IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

export const ASK_SEER_CONSENT_ITEM_KEY = 'ask_seer_consent';

export function AskSeerConsentOption<T>({state}: {state: ComboBoxState<T>}) {
  const itemRef = useRef<HTMLDivElement>(null);
  const [optionDisableOverride, setOptionDisableOverride] = useState(false);

  const {optionProps, labelProps, isFocused, isPressed} = useOption(
    {
      key: ASK_SEER_CONSENT_ITEM_KEY,
      'aria-label': 'Enable Gen AI',
      shouldFocusOnHover: true,
      shouldSelectOnPressUp: true,
      isDisabled: optionDisableOverride,
    },
    state,
    itemRef
  );

  return (
    <AskSeerListItem ref={itemRef} {...optionProps} justifyContent="space-between">
      <InteractionStateLayer isHovered={isFocused} isPressed={isPressed} />
      <Flex align="center" gap="md">
        <IconSeer />
        <AskSeerLabel {...labelProps}>{t('Enable Gen AI')}</AskSeerLabel>
      </Flex>
      <SeerConsentText>
        {tct(
          'Query assistant requires Generative AI which is subject to our [dataProcessingPolicy:data processing policy].',
          {
            dataProcessingPolicy: (
              <TooltipSubExternalLink
                onMouseOver={() => setOptionDisableOverride(true)}
                onMouseOut={() => setOptionDisableOverride(false)}
                href="https://docs.sentry.io/product/security/ai-ml-policy/#use-of-identifying-data-for-generative-ai-features"
              />
            ),
          }
        )}
      </SeerConsentText>
    </AskSeerListItem>
  );
}

const SeerConsentText = styled('p')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: ${p => p.theme.fontWeight.normal};
  margin: 0;
  background-color: none;
`;

const TooltipSubExternalLink = styled(ExternalLink)`
  color: ${p => p.theme.tokens.content.accent};

  :hover {
    color: ${p => p.theme.tokens.content.accent};
    text-decoration: underline;
  }
`;
