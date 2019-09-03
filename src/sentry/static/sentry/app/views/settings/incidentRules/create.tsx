import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Organization, Project} from 'app/types';
import {t} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import RuleForm from './ruleForm';

type RouteParams = {orgId: string};

type Props = {
  organization: Organization;
  projects: Project[];
};

class IncidentRulesCreate extends React.Component<
  RouteComponentProps<RouteParams, {}> & Props
> {
  handleSubmitSuccess = data => {
    const {orgId} = this.props.params;
    this.props.router.push(`/settings/${orgId}/incident-rules/${data.id}/`);
  };

  render() {
    const {params} = this.props;
    const {orgId} = params;

    return (
      <div>
        <SettingsPageHeader title={t('New Incident Rule')} />
        <RuleForm orgId={orgId} onSubmitSuccess={this.handleSubmitSuccess} />
      </div>
    );
  }
}
export default withProjects(withOrganization(IncidentRulesCreate));
