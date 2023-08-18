import {Component} from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import PanelItem from 'sentry/components/panels/panelItem';
import SelectMembers from 'sentry/components/selectMembers';
import TeamSelector from 'sentry/components/teamSelector';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {IssueAlertRuleAction, IssueAlertRuleCondition} from 'sentry/types/alerts';

interface OptionRecord {
  label: string;
  value: string;
}

type Props = {
  disabled: boolean;
  loading: boolean;
  memberValue: string | number;
  onChange: (action: IssueAlertRuleAction) => void;
  options: OptionRecord[];
  organization: Organization;
  project: Project;
  ruleData: IssueAlertRuleAction | IssueAlertRuleCondition;
  teamValue: string | number;
};

class MemberTeamFields extends Component<Props> {
  handleChange = (attribute: 'targetType' | 'targetIdentifier', newValue: string) => {
    const {onChange, ruleData} = this.props;
    if (newValue === ruleData[attribute]) {
      return;
    }
    const newData = {
      ...ruleData,
      [attribute]: newValue,
    };
    // TargetIdentifiers between the targetTypes are not unique, and may
    // wrongly map to something that has not been selected. E.g. A member and
    // project can both have the `targetIdentifier`, `'2'`. Hence we clear the
    // identifier.
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
        <SelectWrapper>
          <SelectControl
            isClearable={false}
            isDisabled={disabled || loading}
            value={ruleData.targetType}
            styles={selectControlStyles}
            options={options}
            onChange={this.handleChangeActorType}
          />
        </SelectWrapper>
        {(teamSelected || memberSelected) && (
          <SelectWrapper>
            {teamSelected ? (
              <TeamSelector
                disabled={disabled}
                key={teamValue}
                project={project}
                // The value from the endpoint is of type `number`, `SelectMembers` require value to be of type `string`
                value={`${ruleData.targetIdentifier}`}
                styles={selectControlStyles}
                onChange={this.handleChangeActorId}
                useId
              />
            ) : memberSelected ? (
              <SelectMembers
                disabled={disabled}
                key={teamSelected ? teamValue : memberValue}
                project={project}
                organization={organization}
                // The value from the endpoint is of type `number`, `SelectMembers` require value to be of type `string`
                value={`${ruleData.targetIdentifier}`}
                styles={selectControlStyles}
                onChange={this.handleChangeActorId}
              />
            ) : null}
          </SelectWrapper>
        )}
      </PanelItemGrid>
    );
  }
}

const PanelItemGrid = styled(PanelItem)`
  display: flex;
  align-items: center;
  padding: 0;
  gap: ${space(2)};
`;

const SelectWrapper = styled('div')`
  width: 200px;
`;

export default MemberTeamFields;
