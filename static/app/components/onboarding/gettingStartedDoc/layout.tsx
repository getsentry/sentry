import {Fragment} from 'react';
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
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
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
  newOrg?: boolean;
  nextSteps?: NextStep[];
};

export function Layout({steps, nextSteps, newOrg}: LayoutProps) {
  const organization = useOrganization();
  const {isSelfHosted} = useLegacyStore(ConfigStore);

  return (
    <Wrapper>
      {!isSelfHosted && newOrg && (
        <ProductSelection
          defaultSelectedProducts={[
            ProductSolution.PERFORMANCE_MONITORING,
            ProductSolution.SESSION_REPLAY,
          ]}
        />
      )}
      {!isSelfHosted && !newOrg && (
        <ProductSelectionAvailabilityHook organization={organization} />
      )}
      <Steps>
        {steps.map(step => (
          <Step key={step.type} {...step} />
        ))}
      </Steps>
      {nextSteps && (
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

const Wrapper = styled('div')`
  h4 {
    margin-bottom: 0.5em;
  }
  p {
    margin-bottom: 1em;
  }
`;
