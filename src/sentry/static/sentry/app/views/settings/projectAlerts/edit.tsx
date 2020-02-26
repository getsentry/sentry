import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Organization} from 'app/types';
import {t} from 'app/locale';
import IncidentRulesDetails from 'app/views/settings/incidentRules/details';
import IssueEditor from 'app/views/settings/projectAlerts/issueEditor';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

type RouteParams = {
  orgId: string;
  projectId: string;
  ruleId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  hasMetricAlerts: boolean;
};

class ProjectAlertsEditor extends React.Component<Props> {
  render() {
    const {hasMetricAlerts, location, params} = this.props;
    const {projectId} = params;
    const alertType = location.pathname.includes('/alerts/metric-rules/')
      ? 'metric'
      : 'issue';
    const title = t('Edit Alert');

    return (
      <React.Fragment>
        <SentryDocumentTitle title={title} objSlug={projectId} />
        <SettingsPageHeader title={title} />

        {(!hasMetricAlerts || alertType === 'issue') && <IssueEditor {...this.props} />}

        {hasMetricAlerts && alertType === 'metric' && (
          <IncidentRulesDetails {...this.props} />
        )}
      </React.Fragment>
    );
  }
}

export default ProjectAlertsEditor;
