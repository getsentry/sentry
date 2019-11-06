import React from 'react';
import styled from 'react-emotion';

import {
  IncidentRule,
  Trigger,
  Action,
  ActionType,
  TargetType,
} from 'app/views/settings/incidentRules/types';
import {Organization, Project} from 'app/types';
import {Panel, PanelBody, PanelItem, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import SelectControl from 'app/components/forms/selectControl';
import SelectMembers from 'app/components/selectMembers';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
  projects: Project[];
  rule: IncidentRule;
  loading: boolean;
  error: boolean;

  actions: Action[];
  className?: string;
  trigger?: Trigger;
  onAdd: (type: Action['type']) => void;
  onChange: (index: number, action: Action) => void;
};

const ActionLabel = {
  [ActionType.EMAIL]: t('E-mail'),
  [ActionType.SLACK]: t('Slack'),
  [ActionType.PAGER_DUTY]: t('Pagerduty'),
};

const TargetLabel = {
  [TargetType.USER]: t('Member'),
  [TargetType.TEAM]: t('Team'),
};

class ActionsPanel extends React.Component<Props> {
  handleAddAction = (value: {label: string; value: Action['type']}) => {
    this.props.onAdd(value.value);
  };

  handleChangeTarget = (index: number, value) => {
    const {actions} = this.props;
    const newAction = {
      ...actions[index],
      targetType: Number(value.value),
      targetIdentifier: '',
    };

    this.props.onChange(index, newAction);
  };

  handleChangeTargetIdentifier = (index, value) => {
    const {actions} = this.props;
    const newAction = {
      ...actions[index],
      targetIdentifier: value.value,
    };

    this.props.onChange(index, newAction);
  };

  render() {
    const {actions, className, loading, organization, projects, rule} = this.props;

    const items = Object.entries(ActionLabel).map(([value, label]) => ({value, label}));

    return (
      <Panel className={className}>
        <PanelHeader hasButtons>
          <div>{t('Actions')}</div>
          <DropdownAutoComplete
            blendCorner
            hideInput
            onSelect={this.handleAddAction}
            items={items}
          >
            {() => <DropdownButton size="small">{t('Add Action')}</DropdownButton>}
          </DropdownAutoComplete>
        </PanelHeader>
        <PanelBody>
          {loading && <LoadingIndicator />}
          {!loading && !actions.length && (
            <EmptyMessage>{t('No Actions have been added')}</EmptyMessage>
          )}
          {actions.map((action: Action, i: number) => {
            const isUser = action.targetType === TargetType.USER;
            const isTeam = action.targetType === TargetType.TEAM;

            return (
              <PanelItemGrid key={i}>
                {ActionLabel[action.type]}

                <SelectControl
                  value={action.targetType}
                  options={Object.entries(TargetLabel).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  onChange={this.handleChangeTarget.bind(this, i)}
                />

                {(isUser || isTeam) && (
                  <SelectMembers
                    key={isTeam ? 'team' : 'member'}
                    showTeam={isTeam}
                    project={projects.find(({slug}) => slug === rule.projects[0])}
                    organization={organization}
                    value={action.targetIdentifier}
                    onChange={this.handleChangeTargetIdentifier.bind(this, i)}
                  />
                )}
              </PanelItemGrid>
            );
          })}
        </PanelBody>
      </Panel>
    );
  }
}

const ActionsPanelWithSpace = styled(ActionsPanel)`
  margin-top: ${space(4)};
`;

const PanelItemGrid = styled(PanelItem)`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  align-items: center;
  grid-gap: ${space(2)};
`;

export default withOrganization(ActionsPanelWithSpace);
