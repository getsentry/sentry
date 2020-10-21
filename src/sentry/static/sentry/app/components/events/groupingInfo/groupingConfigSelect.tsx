import styled from '@emotion/styled';

import {EventGroupingConfig} from 'app/types';
import AsyncComponent from 'app/components/asyncComponent';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';

import {GroupingConfigItem} from '.';

type Props = AsyncComponent['props'] & {
  eventConfigId: string;
  configId: string;
  onSelect: (selection: any) => void;
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
      <DropdownAutoComplete onSelect={onSelect} items={options}>
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
