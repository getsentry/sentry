import React, {Fragment} from 'react';
import styled from '@emotion/styled';

import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Step, StepProps} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  ProductSelection,
  ProductSolution,
} from 'sentry/components/onboarding/productSelection';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

const ProductSelectionAvailabilityHook = HookOrDefault({
  hookName: 'component:product-selection-availability',
});

type NextStep = {
  description: string;
  link: string;
  name: string;
};

export type LayoutProps = {
  steps: StepProps[];
  /**
   * An introduction displayed before the steps
   */
  introduction?: React.ReactNode;
  newOrg?: boolean;
  nextSteps?: NextStep[];
  platformKey?: PlatformKey;
};

export function Layout({
  steps,
  platformKey,
  nextSteps = [],
  newOrg,
  introduction,
}: LayoutProps) {
  const organization = useOrganization();
  const {isSelfHosted} = useLegacyStore(ConfigStore);

  const isJavaScriptPlatform =
    platformKey === 'javascript' || !!platformKey?.match('^javascript-([A-Za-z]+)$');

  const displayProductSelection = !isSelfHosted && isJavaScriptPlatform;

  return (
    <Wrapper>
      {introduction && (
        <Fragment>
          {introduction}
          <Divider />
        </Fragment>
      )}
      {displayProductSelection && newOrg && (
        <ProductSelection
          defaultSelectedProducts={[
            ProductSolution.PERFORMANCE_MONITORING,
            ProductSolution.SESSION_REPLAY,
          ]}
        />
      )}
      {displayProductSelection && !newOrg && (
        <ProductSelectionAvailabilityHook organization={organization} />
      )}
      <Steps withTopSpacing={!displayProductSelection && newOrg}>
        {steps.map(step => (
          <Step key={step.title ?? step.type} {...step} />
        ))}
      </Steps>
      {nextSteps.length > 0 && (
        <Fragment>
          <Divider />
          <h4>{t('Next Steps')}</h4>
          <List symbol="bullet">
            {nextSteps.map(step => (
              <ListItem key={step.name}>
                <ExternalLink href={step.link}>{step.name}</ExternalLink>
                {': '}
                {step.description}
              </ListItem>
            ))}
          </List>
        </Fragment>
      )}
    </Wrapper>
  );
}

const Divider = styled('hr')`
  height: 1px;
  width: 100%;
  background: ${p => p.theme.border};
  border: none;
`;

const Steps = styled('div')<{withTopSpacing?: boolean}>`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  ${p => p.withTopSpacing && `margin-top: ${space(3)}`}
`;

const Wrapper = styled('div')`
  h4 {
    margin-bottom: 0.5em;
  }
  && {
    p {
      margin-bottom: 0;
    }
    h5 {
      margin-bottom: 0;
    }
  }
`;
