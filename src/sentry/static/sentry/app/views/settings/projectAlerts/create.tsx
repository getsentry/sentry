import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Organization, Project} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import IncidentRulesCreate from 'app/views/settings/incidentRules/create';
import IssueEditor from 'app/views/settings/projectAlerts/issueEditor';
import PanelItem from 'app/components/panels/panelItem';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withProject from 'app/utils/withProject';

type RouteParams = {
  orgId: string;
  projectId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
  hasMetricAlerts: boolean;
};

type State = {
  alertType: string | null;
};

class Create extends React.Component<Props, State> {
  state = {
    alertType: this.props.location.pathname.includes('/alerts/rules/')
      ? 'issue'
      : this.props.location.pathname.includes('/alerts/metric-rules/')
      ? 'metric'
      : null,
  };

  componentDidMount() {
    const {organization, project} = this.props;

    trackAnalyticsEvent({
      eventKey: 'new_alert_rule.viewed',
      eventName: 'New Alert Rule: Viewed',
      org_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
    });
  }

  handleChangeAlertType = (alertType: string) => {
    // alertType should be `issue` or `metric`
    this.setState({
      alertType,
    });
  };

  render() {
    const {hasMetricAlerts} = this.props;
    const {projectId} = this.props.params;
    const {alertType} = this.state;

    const shouldShowAlertTypeChooser = hasMetricAlerts;
    const title = t('New Alert');

    return (
      <React.Fragment>
        <SentryDocumentTitle title={title} objSlug={projectId} />
        <SettingsPageHeader title={title} />

        {shouldShowAlertTypeChooser && (
          <Panel>
            <PanelHeader>{t('Choose an Alert Type')}</PanelHeader>
            <PanelBody>
              <PanelItem>
                <RadioGroup
                  label={t('Select an Alert Type')}
                  value={alertType}
                  choices={[
                    [
                      'metric',
                      t('Metric Alert'),
                      t(
                        'Metric alerts allow you to filter and set thresholds on errors. They can be used for high-level monitoring of patterns, or fine-grained monitoring of individual events.'
                      ),
                    ],
                    [
                      'issue',
                      t('Issue Alert'),
                      t(
                        'Issue alerts fire whenever any issue in the project matches your specified criteria, such as a resolved issue re-appearing or an issue affecting many users.'
                      ),
                    ],
                  ]}
                  onChange={this.handleChangeAlertType}
                />
              </PanelItem>
            </PanelBody>
          </Panel>
        )}

        {(!hasMetricAlerts || alertType === 'issue') && <IssueEditor {...this.props} />}

        {hasMetricAlerts && alertType === 'metric' && (
          <IncidentRulesCreate {...this.props} />
        )}
      </React.Fragment>
    );
  }
}

export default withProject(Create);
