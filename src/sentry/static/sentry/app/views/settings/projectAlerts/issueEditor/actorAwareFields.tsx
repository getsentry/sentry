import React from 'react';
import SelectMembers from 'app/components/selectMembers';
import SelectControl from 'app/components/forms/selectControl';
import withProjects from 'app/utils/withProjects';
import withProject from 'app/utils/withProject';

import withOrganization from 'app/utils/withOrganization';
import {Organization, Project} from 'app/types';
import {IssueAlertRuleAction} from 'app/types/alerts';
import styled from 'app/styled';
import {PanelItem} from 'app/components/panels';
import space from 'app/styles/space';

type Props = {
  project: Project;
  organization: Organization;
  projects: Project[];
  disabled: boolean;
  loading: boolean;
  error: boolean;
  action: IssueAlertRuleAction;
  onChange: (action: IssueAlertRuleAction) => void;
};

class ActorAwareFields extends React.PureComponent<Props> {
  render(): React.ReactElement<any, string | React.JSXElementConstructor<any>> {
    const {disabled, loading, projects, project, organization, action} = this.props;
    const {slug: projectSlug} = project;

    const isOwner = action.targetType === 'Owners';
    const isTeam = action.targetType === 'Team';

    return (
      <PanelItemGrid>
        <SelectControl
          disabled={disabled || loading}
          value={action.targetType}
          options={[
            {value: 'Owners', label: 'Owner'},
            {value: 'Team', label: 'Team'},
            {value: 'Member', label: 'Member'},
          ]}
          onChange={this.handleChangeActorType}
        />
        {!isOwner ? (
          <SelectMembers
            disabled={disabled}
            key={isTeam ? 'team' : 'member'}
            showTeam={isTeam}
            project={projects.find(({slug}) => slug === projectSlug)}
            organization={organization}
            // The value from the endpoint is of type `number`, `SelectMembers` require value ot be of type `string`
            value={`${action.targetIdentifier}`}
            onChange={this.handleChangeActorId}
          />
        ) : (
          <span />
        )}
      </PanelItemGrid>
    );
  }

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
}

const PanelItemGrid = styled(PanelItem)`
  display: grid;
  grid-template-columns: 200px 200px;
  align-items: center;
  grid-gap: ${space(2)};
`;

export default withOrganization(withProjects(withProject(ActorAwareFields)));
