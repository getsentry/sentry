import React from 'react';

import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {t} from 'app/locale';

class IncidentRulesList extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  getEndpoints() {
    return [];
    // const {orgId} = this.props.params;

    // return [['rules', `/organizations/${orgId}/incident-rules/`]];
  }

  renderBody() {
    const {orgId} = this.props.params;
    const action = (
      <Button
        priority="primary"
        size="small"
        to={`/settings/${orgId}/incident-rules/new/`}
        icon="icon-circle-add"
      >
        {t('Create New Rule')}
      </Button>
    );

    const isEmpty = true;

    return (
      <div>
        <SettingsPageHeader title={t('Incident Rules')} action={action} />
        <Panel>
          <PanelHeader>{t('Rules')}</PanelHeader>
          <PanelBody>
            {!isEmpty ? null : (
              <EmptyMessage>{t('No Incident rules have been created yet.')}</EmptyMessage>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default IncidentRulesList;
