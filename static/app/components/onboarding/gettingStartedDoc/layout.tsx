import {Fragment} from 'react';
import styled from '@emotion/styled';

import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Step, StepProps} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSelection} from 'sentry/components/onboarding/productSelection';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

const ProductSelectionAvailabilityHook = HookOrDefault({
  hookName: 'component:product-selection-availability',
  defaultComponent: ProductSelection,
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

export function Layout({steps, platformKey, nextSteps = [], introduction}: LayoutProps) {
  const organization = useOrganization();

  return (
    <Wrapper>
      {introduction && (
        <Fragment>
          <Introduction>{introduction}</Introduction>
          <Divider />
        </Fragment>
      )}
      <ProductSelectionAvailabilityHook
        organization={organization}
        platform={platformKey}
      />
      <Steps>
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

const Steps = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Introduction = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
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
