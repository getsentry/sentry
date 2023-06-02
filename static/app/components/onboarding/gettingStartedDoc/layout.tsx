import {Fragment} from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {PRODUCT, ProductSelection} from 'sentry/components/onboarding/productSelection';
import {t} from 'sentry/locale';

import {Step, StepType} from './step';

type NextStep = {
  description: string;
  link: string;
  name: string;
};

type Steps = [
  {
    code: string;
    description: React.ReactNode;
    type: StepType.INSTALL;
  },
  {
    code: string;
    description: React.ReactNode;
    type: StepType.CONFIGURE;
  },
  {
    code: string;
    description: React.ReactNode;
    type: StepType.VERIFY;
  }
];

type Props = {
  language: string;
  steps: Steps;
  nextSteps?: NextStep[];
};

export function Layout({language, steps, nextSteps}: Props) {
  return (
    <Fragment>
      <ProductSelection
        defaultSelectedProducts={[PRODUCT.PERFORMANCE_MONITORING, PRODUCT.SESSION_REPLAY]}
      />
      <div>
        {steps.map(step => (
          <Step
            key={step.type}
            type={step.type}
            description={step.description}
            code={step.code}
            language={language}
          />
        ))}
      </div>
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
    </Fragment>
  );
}

const Divider = styled('hr')`
  border-top-color: ${p => p.theme.border};
`;
