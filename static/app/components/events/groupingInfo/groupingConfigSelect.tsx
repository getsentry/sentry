import styled from '@emotion/styled';

import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {EventGroupingConfig} from 'sentry/types';

import {GroupingConfigItem} from '.';

type Props = DeprecatedAsyncComponent['props'] & {
  configId: string;
  eventConfigId: string;
  onSelect: (selection: any) => void;
  organizationSlug: string;
};

type State = DeprecatedAsyncComponent['state'] & {
  configs: EventGroupingConfig[];
};

class GroupingConfigSelect extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      configs: [],
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organizationSlug} = this.props;
    return [['configs', `/organizations/${organizationSlug}/grouping-configs/`]];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {configId, eventConfigId, onSelect} = this.props;
    const {configs} = this.state;

    const options = configs.map(({id, hidden}) => ({
      value: id,
      label: (
        <GroupingConfigItem isHidden={hidden} isActive={id === eventConfigId}>
          {id}
        </GroupingConfigItem>
      ),
    }));

    return (
      <DropdownAutoComplete onSelect={onSelect} items={options}>
        {({isOpen}) => (
          <Tooltip title={t('Click here to experiment with other grouping configs')}>
            <StyledDropdownButton isOpen={isOpen} size="sm">
              <GroupingConfigItem isActive={eventConfigId === configId}>
                {configId}
              </GroupingConfigItem>
            </StyledDropdownButton>
          </Tooltip>
        )}
      </DropdownAutoComplete>
    );
  }
}

const StyledDropdownButton = styled(DropdownButton)`
  font-weight: inherit;
`;

export default GroupingConfigSelect;
