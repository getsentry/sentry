import React from 'react';
import styled from '@emotion/styled';

import SelectMembers from 'app/components/selectMembers';
import SelectControl from 'app/components/forms/selectControl';
import {Organization, Project} from 'app/types';
import {IssueAlertRuleAction, MailActionTargetType} from 'app/types/alerts';
import {PanelItem} from 'app/components/panels';
import space from 'app/styles/space';

type Props = {
  project: Project;
  organization: Organization;
  disabled: boolean;
  loading: boolean;
  action: IssueAlertRuleAction;
  onChange: (action: IssueAlertRuleAction) => void;
};

interface OptionRecord {
  value: string;
  label: string;
}

class MailActionFields extends React.Component<Props> {
  handleChange = (attribute: 'targetType' | 'targetIdentifier', newValue: string) => {
    const {onChange, action} = this.props;
    if (newValue === action[attribute]) {
      return;
    }
    const newAction = {
      ...action,
      [attribute]: newValue,
    };
    /**
     * TargetIdentifiers between the targetTypes are not unique, and may wrongly map to something that has not been
     * selected. E.g. A member and project can both have the `targetIdentifier`, `'2'`. Hence we clear the identifier.
     **/
    if (attribute === 'targetType') {
      newAction.targetIdentifier = '';
    }
    onChange(newAction);
  };

  handleChangeActorType = (optionRecord: OptionRecord) => {
    this.handleChange('targetType', optionRecord.value);
  };

  handleChangeActorId = (optionRecord: OptionRecord & {[key: string]: any}) => {
    this.handleChange('targetIdentifier', optionRecord.value);
  };

  render(): React.ReactElement {
    const {disabled, loading, project, organization, action} = this.props;

    const isIssueOwners = action.targetType === MailActionTargetType.IssueOwners;
    const isTeam = action.targetType === MailActionTargetType.Team;

    const selectControlStyles = {
      control: provided => ({
        ...provided,
        minHeight: '28px',
        height: '28px',
      }),
    };

    return (
      <PanelItemGrid>
        <SelectControl
          isClearable={false}
          isDisabled={disabled || loading}
          value={action.targetType}
          styles={selectControlStyles}
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
            project={project}
            organization={organization}
            // The value from the endpoint is of type `number`, `SelectMembers` require value to be of type `string`
            value={`${action.targetIdentifier}`}
            styles={selectControlStyles}
            onChange={this.handleChangeActorId}
          />
        ) : (
          <span />
        )}
      </PanelItemGrid>
    );
  }
}

const PanelItemGrid = styled(PanelItem)`
  display: grid;
  grid-template-columns: 200px 200px;
  padding: 0;
  align-items: center;
  grid-gap: ${space(2)};
`;

export default MailActionFields;
