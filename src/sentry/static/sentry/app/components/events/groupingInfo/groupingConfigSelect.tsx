import React from 'react';
import styled from '@emotion/styled';

import {EventGroupingConfig} from 'app/types';
import AsyncComponent from 'app/components/asyncComponent';
import DropdownAutoComplete from 'app/components/dropdownAutoCompleteV2';
import DropdownButton from 'app/components/dropdownButton';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';

import {GroupingConfigItem} from '.';

type DropdownAutoCompleteProps = React.ComponentProps<typeof DropdownAutoComplete>;

type Props = AsyncComponent['props'] & {
  eventConfigId: string;
  configId: string;
  onSelect: NonNullable<DropdownAutoCompleteProps['onSelect']>;
};

type State = AsyncComponent['state'] & {
  configs: EventGroupingConfig[];
};

class GroupingConfigSelect extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      configs: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    return [['configs', '/grouping-configs/']];
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
      <DropdownAutoComplete onSelect={onSelect} alignMenu="left" items={options}>
        {({isOpen}) => (
          <Tooltip title={t('Click here to experiment with other grouping configs')}>
            <StyledDropdownButton isOpen={isOpen} size="small">
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
