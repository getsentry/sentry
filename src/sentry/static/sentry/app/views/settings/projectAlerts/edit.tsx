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
  hasCreateFromDiscover: boolean;
};

function ProjectAlertsEditor(props: Props) {
  const {hasMetricAlerts, location, params} = props;
  const {projectId} = params;
  const alertType = location.pathname.includes('/alerts/metric-rules/')
    ? 'metric'
    : 'issue';
  const title = t('Edit Alert');

  return (
    <React.Fragment>
      <SentryDocumentTitle title={title} objSlug={projectId} />
      <SettingsPageHeader title={title} />

      {(!hasMetricAlerts || alertType === 'issue') && <IssueEditor {...props} />}

      {hasMetricAlerts && alertType === 'metric' && <IncidentRulesDetails {...props} />}
    </React.Fragment>
  );
}

export default ProjectAlertsEditor;
