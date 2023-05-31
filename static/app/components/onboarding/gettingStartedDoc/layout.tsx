import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {PRODUCT, ProductSelection} from 'sentry/components/onboarding/productSelection';
import {t} from 'sentry/locale';
import {decodeList} from 'sentry/utils/queryString';
import useRouter from 'sentry/utils/useRouter';

import {Step, StepType} from './step';

type NextStep = {
  description: string;
  link: string;
  name: string;
  hideForProduct?: PRODUCT;
};

type Props = {
  language: string;
  nextSteps: NextStep[];
  steps: [
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
};

export function Layout({language, steps, nextSteps}: Props) {
  const router = useRouter();
  const products = decodeList(router.location.query.product);
  return (
    <div>
      <div>
        <ProductSelection
          defaultSelectedProducts={[
            PRODUCT.PERFORMANCE_MONITORING,
            PRODUCT.SESSION_REPLAY,
          ]}
        />
      </div>
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
      <Divider />
      <div>
        <h4>{t('Next Steps')}</h4>
        <List symbol="bullet">
          {nextSteps
            .filter(nextStep => {
              if (!nextStep.hideForProduct) {
                return true;
              }
              return !products.includes(nextStep.hideForProduct);
            })
            .map(step => (
              <ListItem key={step.name}>
                <ExternalLink href={step.link}>{step.name}</ExternalLink>
                {': '}
                {step.description}
              </ListItem>
            ))}
        </List>
      </div>
    </div>
  );
}

const Divider = styled('hr')`
  border-top-color: ${p => p.theme.border};
`;
