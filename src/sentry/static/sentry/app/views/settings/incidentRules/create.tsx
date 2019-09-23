import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {t} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

import RuleForm from './ruleForm';

type RouteParams = {orgId: string};
type Props = {};

class IncidentRulesCreate extends React.Component<
  RouteComponentProps<RouteParams, {}> & Props
> {
  handleSubmitSuccess = data => {
    const {orgId} = this.props.params;
    this.props.router.push(`/settings/${orgId}/incident-rules/${data.id}/`);
  };

  render() {
    const {orgId} = this.props.params;

    return (
      <div>
        <SettingsPageHeader title={t('New Incident Rule')} />
        <RuleForm orgId={orgId} onSubmitSuccess={this.handleSubmitSuccess} />
      </div>
    );
  }
}
export default IncidentRulesCreate;
