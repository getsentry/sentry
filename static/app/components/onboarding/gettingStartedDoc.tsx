import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {PRODUCT, ProductSelection} from 'sentry/components/onboarding/productSelection';
import {t} from 'sentry/locale';

type NextStep = {
  description: string;
  link: string;
  name: string;
};

type Props = {
  nextSteps: NextStep[];
};

export function GettingStartedDoc({nextSteps}: Props) {
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
      <hr />
      <div>okoko</div>
      <hr />
      <div>
        <h2>{t('Next Steps')}</h2>
        <List>
          {nextSteps.map(step => (
            <ListItem key={step.name}>
              <ExternalLink href={step.link}>{step.name}</ExternalLink>
              {step.description}
            </ListItem>
          ))}
        </List>
      </div>
    </div>
  );
}
