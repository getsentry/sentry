import React from 'react';

import AsyncView from 'app/views/asyncView';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {t} from 'app/locale';

class IncidentRulesDetails extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  getEndpoints() {
    return [];
    // const {orgId, incidentRuleId} = this.props.params;

    // return [['rule', `/organizations/${orgId}/incident-rules/${ incidentRuleId }/`]];
  }

  renderBody() {
    return (
      <div>
        <SettingsPageHeader title={t('Incident Rule')} />
        <Panel>
          <PanelHeader>{t('Rule')}</PanelHeader>
          <PanelBody>TODO</PanelBody>
        </Panel>
      </div>
    );
  }
}

export default IncidentRulesDetails;
