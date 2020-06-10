import React from 'react';
import styled from '@emotion/styled';

import Card from 'app/components/card';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import Radio from 'app/components/radio';
import textStyles from 'app/styles/text';
import BulletList from 'app/styles/bulletList';
import FeatureBadge from 'app/components/featureBadge';
import Tooltip from 'app/components/tooltip';
import Feature from 'app/components/acl/feature';

type Props = {
  selected?: string | null;
  onChange: (type: string) => void;
};

const MetricsTooltip = ({children}: {children?: React.ReactNode}) => (
  <Tooltip
    title={t(
      `A metric is the value of an aggregate function like count() or avg()
       applied to your events over time`
    )}
  >
    <abbr>{children}</abbr>
  </Tooltip>
);

const IssuesTooltip = ({children}: {children?: React.ReactNode}) => (
  <Tooltip
    title={t(
      `An Issue is a unique error in Sentry, created by grouping error events
       based on stack trace and other factors.`
    )}
  >
    <abbr>{children}</abbr>
  </Tooltip>
);

const AlertTypeChooser = ({selected, onChange}: Props) => (
  <Container>
    <TypeCard interactive onClick={() => onChange('metric')}>
      <RadioLabel>
        <Radio
          aria-label="metric"
          checked={selected === 'metric'}
          onChange={() => onChange('metric')}
        />
        {t('Metric Alert')}
        <FeatureBadge type="beta" />
      </RadioLabel>
      <Feature
        requireAll
        features={[
          'organizations:transaction-events',
          'organizations:incidents-performance',
        ]}
      >
        {({hasFeature}) =>
          hasFeature ? (
            <React.Fragment>
              <p>
                {tct(`Notifies you when a [tooltip:metric] exceeds a threshold.`, {
                  tooltip: <MetricsTooltip />,
                })}
              </p>
              {!selected && (
                <React.Fragment>
                  <ExampleHeading>{t('For Example:')}</ExampleHeading>
                  <BulletList>
                    <li>{t('Performance metrics like latency and apdex')}</li>
                    <li>
                      {t(
                        `Frequency of error events or users affected in the
                       project`
                      )}
                    </li>
                  </BulletList>
                </React.Fragment>
              )}
            </React.Fragment>
          ) : (
            <React.Fragment>
              <p>
                {tct(
                  `Notifies you when a [tooltip:metric] like frequency of events or users affected in
                   the project exceeds a threshold.`,
                  {tooltip: <MetricsTooltip />}
                )}
              </p>
              {!selected && (
                <React.Fragment>
                  <ExampleHeading>{t('For Example:')}</ExampleHeading>
                  <BulletList>
                    <li>{t('Total events in the project exceed 1000/minute')}</li>
                    <li>
                      {tct(
                        'Events with tag [code:database] and "API" in the title exceed 100/minute',
                        {code: <code />}
                      )}
                    </li>
                  </BulletList>
                </React.Fragment>
              )}
            </React.Fragment>
          )
        }
      </Feature>
    </TypeCard>
    <TypeCard interactive onClick={() => onChange('issue')}>
      <RadioLabel>
        <Radio
          aria-label="issue"
          checked={selected === 'issue'}
          onChange={() => onChange('issue')}
        />
        {t('Issue Alert')}
      </RadioLabel>
      <p>
        {tct(
          `Notifies you when individual [tooltip:Sentry Issues] trigger your
           alerting criteria.`,
          {tooltip: <IssuesTooltip />}
        )}
      </p>
      {!selected && (
        <React.Fragment>
          <ExampleHeading>{t('For Example:')}</ExampleHeading>
          <BulletList>
            <li>{t('New Issues or regressions')}</li>
            <li>{t('Frequency of individual Issues exceeds 100/minute')}</li>
          </BulletList>
        </React.Fragment>
      )}
    </TypeCard>
  </Container>
);

const RadioLabel = styled('label')`
  cursor: pointer;
  margin-bottom: ${space(3)};
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  align-items: center;
  grid-gap: ${space(2)};
`;

const ExampleHeading = styled('div')`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
  color: ${p => p.theme.gray600};
  margin-bottom: ${space(2)};
`;

const Container = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: ${space(3)};
`;

const TypeCard = styled(Card)`
  cursor: pointer;
  padding: ${space(4)};
  margin-bottom: ${space(3)};
  ${textStyles};
`;

export default AlertTypeChooser;
