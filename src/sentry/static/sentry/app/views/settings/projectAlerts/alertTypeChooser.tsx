import * as React from 'react';
import styled from '@emotion/styled';

import Card from 'app/components/card';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import Radio from 'app/components/radio';
import textStyles from 'app/styles/text';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import Tooltip from 'app/components/tooltip';
import Feature from 'app/components/acl/feature';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';

type AlertType = 'metric' | 'issue' | null;

type Props = {
  organization: Organization;
  selected?: string | null;
  onChange: (type: AlertType) => void;
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
      `Sentry groups similar events into an Issue based on their stack trace
       and other factors.`
    )}
  >
    <abbr>{children}</abbr>
  </Tooltip>
);

const TypeChooser = ({onChange, organization, selected}: Props) => {
  const trackedOnChange = (type: AlertType) => {
    trackAnalyticsEvent({
      eventKey: 'alert_chooser_cards.select',
      eventName: 'Alert Chooser Cards: Select',
      organization_id: organization.id,
      type,
    });

    onChange(type);
  };

  return (
    <Container>
      <TypeCard interactive onClick={() => trackedOnChange('metric')}>
        <RadioLabel>
          <Radio
            aria-label="metric"
            checked={selected === 'metric'}
            onChange={() => trackedOnChange('metric')}
          />
          {t('Metric Alert')}
        </RadioLabel>
        <Feature requireAll features={['organizations:performance-view']}>
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
                    <List symbol="bullet">
                      <ListItem>
                        {t('Performance metrics like latency and apdex')}
                      </ListItem>
                      <ListItem>
                        {t('Frequency of error events or users affected in the project')}
                      </ListItem>
                    </List>
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
                    <List symbol="bullet">
                      <ListItem>
                        {t('Total events in the project exceed 1000/minute')}
                      </ListItem>
                      <ListItem>
                        {tct(
                          'Events with tag [code:database] and "API" in the title exceed 100/minute',
                          {code: <code />}
                        )}
                      </ListItem>
                    </List>
                  </React.Fragment>
                )}
              </React.Fragment>
            )
          }
        </Feature>
      </TypeCard>
      <TypeCard interactive onClick={() => trackedOnChange('issue')}>
        <RadioLabel>
          <Radio
            aria-label="issue"
            checked={selected === 'issue'}
            onChange={() => trackedOnChange('issue')}
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
            <List symbol="bullet">
              <ListItem>{t('New Issues or regressions')}</ListItem>
              <ListItem>
                {t('Frequency of individual Issues exceeds 100/minute')}
              </ListItem>
            </List>
          </React.Fragment>
        )}
      </TypeCard>
    </Container>
  );
};

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

export default TypeChooser;
