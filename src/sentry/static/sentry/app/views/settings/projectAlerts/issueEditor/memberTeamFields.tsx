import * as React from 'react';
import styled from '@emotion/styled';

import SelectMembers from 'app/components/selectMembers';
import SelectControl from 'app/components/forms/selectControl';
import {Organization, Project} from 'app/types';
import {IssueAlertRuleAction, IssueAlertRuleCondition} from 'app/types/alerts';
import {PanelItem} from 'app/components/panels';
import space from 'app/styles/space';

interface OptionRecord {
  value: string;
  label: string;
}

type Props = {
  project: Project;
  organization: Organization;
  disabled: boolean;
  loading: boolean;
  ruleData: IssueAlertRuleAction | IssueAlertRuleCondition;
  onChange: (action: IssueAlertRuleAction) => void;
  options: OptionRecord[];
  memberValue: string | number;
  teamValue: string | number;
};

class MemberTeamFields extends React.Component<Props> {
  handleChange = (attribute: 'targetType' | 'targetIdentifier', newValue: string) => {
    const {onChange, ruleData} = this.props;
    if (newValue === ruleData[attribute]) {
      return;
    }
    const newData = {
      ...ruleData,
      [attribute]: newValue,
    };
    /**
     * TargetIdentifiers between the targetTypes are not unique, and may wrongly map to something that has not been
     * selected. E.g. A member and project can both have the `targetIdentifier`, `'2'`. Hence we clear the identifier.
     **/
    if (attribute === 'targetType') {
      newData.targetIdentifier = '';
    }
    onChange(newData);
  };

  handleChangeActorType = (optionRecord: OptionRecord) => {
    this.handleChange('targetType', optionRecord.value);
  };

  handleChangeActorId = (optionRecord: OptionRecord & {[key: string]: any}) => {
    this.handleChange('targetIdentifier', optionRecord.value);
  };

  render(): React.ReactElement {
    const {
      disabled,
      loading,
      project,
      organization,
      ruleData,
      memberValue,
      teamValue,
      options,
    } = this.props;

    const teamSelected = ruleData.targetType === teamValue;
    const memberSelected = ruleData.targetType === memberValue;

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
          value={ruleData.targetType}
          styles={selectControlStyles}
          options={options}
          onChange={this.handleChangeActorType}
        />
        {teamSelected || memberSelected ? (
          <SelectMembers
            disabled={disabled}
            key={teamSelected ? teamValue : memberValue}
            showTeam={teamSelected}
            project={project}
            organization={organization}
            // The value from the endpoint is of type `number`, `SelectMembers` require value to be of type `string`
            value={`${ruleData.targetIdentifier}`}
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

export default MemberTeamFields;
