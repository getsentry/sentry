import {RouteComponentProps} from 'react-router/lib/Router';
import {Link} from 'react-router';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import space from 'app/styles/space';

import {IncidentRule} from './constants';
import {deleteRule} from './actions';

type State = {
  rules: IncidentRule[];
} & AsyncView['state'];

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}>;

class IncidentRulesList extends AsyncView<Props, State> {
  getEndpoints() {
    const {orgId} = this.props.params;

    return [['rules', `/organizations/${orgId}/alert-rules/`] as [string, string]];
  }

  handleRemoveRule = async (rule: IncidentRule) => {
    const {orgId} = this.props.params;

    // Optimistic update
    const oldRules = this.state.rules.slice(0);

    const newRules = this.state.rules.filter(({id}) => id !== rule.id);

    try {
      this.setState({
        rules: newRules,
      });

      await deleteRule(this.api, orgId, rule);
    } catch (_err) {
      this.setState({
        rules: oldRules,
      });
    }
  };

  renderLoading() {
    return this.renderBody();
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

    const isLoading = this.state.loading;

    const isEmpty = !isLoading && !this.state.rules.length;

    return (
      <div>
        <SettingsPageHeader title={t('Incident Rules')} action={action} />
        <Panel>
          <PanelHeader>{t('Rules')}</PanelHeader>
          <PanelBody>
            {isLoading && <LoadingIndicator />}

            {!isLoading &&
              !isEmpty &&
              this.state.rules.map(rule => (
                <RuleRow key={rule.id}>
                  <RuleLink to={`/settings/${orgId}/incident-rules/${rule.id}/`}>
                    {rule.name}
                  </RuleLink>
                  <Confirm
                    priority="danger"
                    onConfirm={() => this.handleRemoveRule(rule)}
                    message={t('Are you sure you want to remove this rule?')}
                  >
                    <RemoveButton
                      size="small"
                      icon="icon-trash"
                      label={t('Remove Rule')}
                    />
                  </Confirm>
                </RuleRow>
              ))}

            {!isLoading && isEmpty && (
              <EmptyMessage>{t('No Incident rules have been created yet.')}</EmptyMessage>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default IncidentRulesList;

const RuleRow = styled(PanelItem)`
  padding: 0;
  align-items: center;
  justify-content: space-between;
`;

const RuleLink = styled(Link)`
  flex: 1;
  padding: ${space(2)};
`;

const RemoveButton = styled(Button)`
  margin: ${space(2)};
`;
