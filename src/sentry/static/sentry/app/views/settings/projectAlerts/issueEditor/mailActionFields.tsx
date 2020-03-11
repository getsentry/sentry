import React from 'react';
import styled from '@emotion/styled';

import SelectMembers from 'app/components/selectMembers';
import SelectControl from 'app/components/forms/selectControl';
import {Organization, Project} from 'app/types';
import {IssueAlertRuleAction} from 'app/types/alerts';
import {PanelItem} from 'app/components/panels';
import space from 'app/styles/space';
import withProjects from 'app/utils/withProjects';
import withProject from 'app/utils/withProject';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  project: Project;
  organization: Organization;
  projects: Project[];
  disabled: boolean;
  loading: boolean;
  action: IssueAlertRuleAction;
  onChange: (action: IssueAlertRuleAction) => void;
};

export enum MailActionTargetType {
  IssueOwners = 'IssueOwners',
  Team = 'Team',
  Member = 'Member',
}

class MailActionFields extends React.PureComponent<Props> {
  handleChange = (attribute: 'targetType' | 'targetIdentifier', e: HTMLInputElement) => {
    const {onChange, action} = this.props;
    if (e.value === action[attribute]) {
      return;
    }
    const newAction = {...action};
    newAction[attribute] = `${e.value}`;
    /**
     * TargetIdentifiers between the targetTypes are not unique, and may wrongly map to something that has not been
     * selected. E.g. A member and project can both have the `targetIdentifier`, `'2'`. Hence we clear the identifier.
     **/
    if (attribute === 'targetType') {
      newAction.targetIdentifier = '';
    }
    onChange(newAction);
    /**
     * Force update is needed because parent component mutates its props with the new values that have changed.
     * Effectively, this causes `action`, a nested prop from the parent, to be referentially the same even if a new
     * `action` is passed to the change handler.
     **/
    this.forceUpdate();
  };

  handleChangeActorType = (e: HTMLInputElement) => {
    this.handleChange('targetType', e);
  };

  handleChangeActorId = (e: HTMLInputElement) => {
    this.handleChange('targetIdentifier', e);
  };

  render: () => React.ReactElement = () => {
    const {disabled, loading, projects, project, organization, action} = this.props;
    const {slug: projectSlug} = project;

    const isIssueOwners = action.targetType === MailActionTargetType.IssueOwners;
    const isTeam = action.targetType === MailActionTargetType.Team;

    return (
      <PanelItemGrid>
        <SelectControl
          isClearable={false}
          disabled={disabled || loading}
          value={action.targetType}
          styles={{
            control: provided => ({
              ...provided,
              minHeight: '28px',
              height: '28px',
            }),
          }}
          options={[
            {value: MailActionTargetType.IssueOwners, label: 'Issue Owners'},
            {value: MailActionTargetType.Team, label: 'Team'},
            {value: MailActionTargetType.Member, label: 'Member'},
          ]}
          onChange={this.handleChangeActorType}
        />
        {!isIssueOwners ? (
          <SelectMembers
            disabled={disabled}
            key={isTeam ? MailActionTargetType.Team : MailActionTargetType.Member}
            showTeam={isTeam}
            project={projects.find(({slug}) => slug === projectSlug)}
            organization={organization}
            // The value from the endpoint is of type `number`, `SelectMembers` require value to be of type `string`
            value={`${action.targetIdentifier}`}
            styles={{
              control: provided => ({
                ...provided,
                minHeight: '28px',
                height: '28px',
              }),
            }}
            onChange={this.handleChangeActorId}
          />
        ) : (
          <span />
        )}
      </PanelItemGrid>
    );
  };
}

const PanelItemGrid = styled(PanelItem)`
  display: grid;
  grid-template-columns: 200px 200px;
  padding: 0;
  align-items: center;
  grid-gap: ${space(2)};
`;

export default withOrganization(withProjects(withProject(MailActionFields)));
