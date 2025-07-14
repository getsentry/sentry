import {useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useOption} from '@react-aria/listbox';
import type {ComboBoxState} from '@react-stately/combobox';

import {promptsUpdate} from 'sentry/actionCreators/prompts';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {makeOrganizationSeerSetupQueryKey} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  useIsFetching,
  useIsMutating,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export const ASK_SEER_ITEM_KEY = 'ask_seer';
export const ASK_SEER_CONSENT_ITEM_KEY = 'ask_seer_consent';

const setupCheckQueryKey = (orgSlug: string) =>
  `/organizations/${orgSlug}/seer/setup-check/`;

export function useSeerAcknowledgeMutation() {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const {mutate} = useMutation({
    mutationKey: [setupCheckQueryKey(organization.slug)],
    mutationFn: () => {
      return promptsUpdate(api, {
        organization,
        feature: 'seer_autofix_setup_acknowledged',
        status: 'dismissed',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [setupCheckQueryKey(organization.slug)],
      });
    },
  });

  return {mutate};
}

function AskSeerConsentOption<T>({state}: {state: ComboBoxState<T>}) {
  const organization = useOrganization();
  const itemRef = useRef<HTMLDivElement>(null);
  const [optionDisableOverride, setOptionDisableOverride] = useState(false);
  const {mutate: seerAcknowledgeMutate} = useSeerAcknowledgeMutation();

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

  const handleClick = () => {
    trackAnalytics('trace.explorer.ai_query_interface', {
      organization,
      action: 'consent_accepted',
    });
    seerAcknowledgeMutate();
  };

  return (
    <AskSeerListItem
      ref={itemRef}
      onClick={handleClick}
      {...optionProps}
      justifyContent="space-between"
    >
      <InteractionStateLayer isHovered={isFocused} isPressed={isPressed} />
      <div style={{display: 'flex', alignItems: 'center', gap: space(1)}}>
        <IconSeer />
        <AskSeerLabel {...labelProps}>
          {t('Enable Gen AI')} <FeatureBadge type="beta" />
        </AskSeerLabel>
      </div>
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
  const organization = useOrganization();
  const {gaveSeerConsent} = useSearchQueryBuilder();
  const isMutating = useIsMutating({
    mutationKey: [setupCheckQueryKey(organization.slug)],
  });

  const isPendingSetupCheck =
    useIsFetching({
      queryKey: makeOrganizationSeerSetupQueryKey(organization.slug),
    }) > 0;

  if (isPendingSetupCheck || isMutating) {
    return (
      <AskSeerPane>
        <AskSeerListItem>
          <AskSeerLabel width="auto">{t('Loading Seer')}</AskSeerLabel>
          <LoadingIndicator size={16} style={{margin: 0}} />
        </AskSeerListItem>
      </AskSeerPane>
    );
  }

  if (gaveSeerConsent) {
    return (
      <AskSeerPane>
        <AskSeerOption state={state} />
      </AskSeerPane>
    );
  }

  return (
    <AskSeerPane>
      <AskSeerConsentOption state={state} />
    </AskSeerPane>
  );
}

const TooltipSubExternalLink = styled(ExternalLink)`
  color: ${p => p.theme.purple400};

  :hover {
    color: ${p => p.theme.purple400};
    text-decoration: underline;
  }
`;

const SeerConsentText = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: ${p => p.theme.fontWeight.normal};
  margin: 0;
  background-color: none;
`;

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

const AskSeerListItem = styled('div')<{justifyContent?: 'flex-start' | 'space-between'}>`
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
  justify-content: ${p => p.justifyContent ?? 'flex-start'};
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

const AskSeerLabel = styled('span')<{width?: 'auto'}>`
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.purple400};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  display: flex;
  align-items: center;
  gap: ${space(1)};
  width: ${p => p.width};
`;
