import React from 'react';
import styled from '@emotion/styled';

import Card from 'app/components/card';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import Radio from 'app/components/radio';
import textStyles from 'app/styles/text';
import {List, ListItem} from 'app/components/list';
import FeatureBadge from 'app/components/featureBadge';
import Tooltip from 'app/components/tooltip';
import {Panel, PanelHeader} from 'app/components/panels';
import RadioField from 'app/views/settings/components/forms/radioField';
import Feature from 'app/components/acl/feature';
import ExternalLink from 'app/components/links/externalLink';
import withExperiment from 'app/utils/withExperiment';
import {ExperimentAssignment} from 'app/types/experiments';
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

const TypeChooserCards = ({onChange, organization, selected}: Props) => {
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
          <FeatureBadge type="beta" />
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
                    <List>
                      <ListItem>
                        {t('Performance metrics like latency and apdex')}
                      </ListItem>
                      <ListItem>
                        {t(
                          `Frequency of error events or users affected in the
                       project`
                        )}
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
                    <List>
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
            <List>
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

type State = {
  type?: 'frequency' | 'issues';
  granularity?: 'project' | 'issue';
};

class TypeChooserFlow extends React.Component<Props, State> {
  state: State = {};

  update = (state: Partial<State>) =>
    this.setState(state, () => {
      const {type, granularity} = this.state;
      const {organization, onChange} = this.props;

      const selectMetricAlerts = type === 'frequency' && granularity === 'project';

      const selectIssueAlerts =
        type === 'issues' || (type === 'frequency' && granularity === 'issue');

      trackAnalyticsEvent({
        eventKey: 'alert_chooser_flow.select',
        eventName: 'Alert Chooser Flow: Select',
        organization_id: organization.id,
        type,
        granularity,
      });

      onChange(selectMetricAlerts ? 'metric' : selectIssueAlerts ? 'issue' : null);
    });

  render() {
    const {type, granularity} = this.state;

    return (
      <Panel>
        <PanelHeader>{t('Alert details')}</PanelHeader>
        <RadioField
          label={t('Alert type')}
          help={tct(
            'Remember that Sentry groups similar events into an Issue based on their stack trace and other factors. [learnMore:Learn more]',
            {
              learnMore: (
                <ExternalLink href="https://docs.sentry.io/data-management/event-grouping/" />
              ),
            }
          )}
          onChange={value => this.update({type: value})}
          value={type}
          choices={[
            ['frequency', t('Frequency of events or users affected increasing')],
            ['issues', t('New issues and regressions')],
          ]}
        />
        {type === 'frequency' && (
          <RadioField
            label={t('Granularity')}
            help={t(
              'Frequency thresholds can be set per Issue or for the entire project.'
            )}
            onChange={value => this.update({granularity: value})}
            value={granularity}
            choices={[
              [
                'project',
                t('Frequency of events in entire project'),
                <React.Fragment key="list">
                  <Example>{t('Total events in the project exceed 1000/minute')}</Example>
                  <Example>
                    {t(
                      'Events with tag `database` and API in the title exceed 100/minute'
                    )}
                  </Example>
                </React.Fragment>,
              ],
              [
                'issue',
                t('Frequency of individual Issues'),

                <React.Fragment key="list">
                  <Example>
                    {t(
                      `Any single Issue on the checkout page happens more than
                       100 times in a minute.`
                    )}
                  </Example>
                </React.Fragment>,
              ],
            ]}
          />
        )}
      </Panel>
    );
  }
}

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

const Example = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray500};
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

type ExperimentProps = {
  experimentAssignment: ExperimentAssignment['MetricAlertsTypeChooser'];
};

export default withExperiment(
  ({experimentAssignment, ...props}: Props & ExperimentProps) =>
    experimentAssignment === 'flowChoice' ? (
      <TypeChooserFlow {...props} />
    ) : (
      <TypeChooserCards {...props} />
    ),
  {experiment: 'MetricAlertsTypeChooser'}
);
