import {useRef} from 'react';
import styled from '@emotion/styled';
import {useOption} from '@react-aria/listbox';
import type {ComboBoxState} from '@react-stately/combobox';

import { FeatureBadge } from 'sentry/components/core/badge/featureBadge';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export const ASK_SEER_ITEM_KEY = 'ask_seer';
export const ASK_SEER_CONSENT_ITEM_KEY = 'ask_seer_consent';

function AskSeerOption<T>({state}: {state: ComboBoxState<T>}) {
  const ref = useRef<HTMLDivElement>(null);
  const {setDisplaySeerResults} = useSearchQueryBuilder();
  const organization = useOrganization();

  const {optionProps, labelProps, isFocused, isPressed} = useOption(
    {
      key: ASK_SEER_ITEM_KEY,
      'aria-label': 'Ask Seer',
      shouldFocusOnHover: true,
      shouldSelectOnPressUp: true,
    },
    state,
    ref
  );

  const handleClick = () => {
    trackAnalytics('trace.explorer.ai_query_interface', {
      organization,
      action: 'opened',
    });
    setDisplaySeerResults(true);
  };

  return (
    <AskSeerListItem ref={ref} onClick={handleClick} {...optionProps}>
      <InteractionStateLayer isHovered={isFocused} isPressed={isPressed} />
      <IconSeer />
      <AskSeerLabel {...labelProps}>
        {t('Ask Seer')} <FeatureBadge type="beta" />
      </AskSeerLabel>
    </AskSeerListItem>
  );
}

export function AskSeer<T>({state}: {state: ComboBoxState<T>}) {
  return (
    <AskSeerPane>
      <AskSeerOption state={state} />
    </AskSeerPane>
  );
}

const AskSeerPane = styled('div')`
  grid-area: seer;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  background-color: ${p => p.theme.purple100};
  width: 100%;
`;

const AskSeerListItem = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  padding: ${space(1)} ${space(1.5)};
  background: transparent;
  border-radius: 0;
  background-color: none;
  box-shadow: none;
  color: ${p => p.theme.purple400};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  text-align: left;
  justify-content: flex-start;
  gap: ${space(1)};
  list-style: none;
  margin: 0;

  &:hover,
  &:focus {
    cursor: pointer;
  }

  &[aria-selected='true'] {
    background: ${p => p.theme.purple100};
    color: ${p => p.theme.purple400};
  }
`;

const AskSeerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.purple400};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
