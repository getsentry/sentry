import React from 'react';

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
  onSelect: () => void;
};

type State = AsyncComponent['state'] & {
  configs: EventGroupingConfig[];
};

class GroupingConfigSelect extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    return [['configs', '/grouping-configs/']];
  }

  renderBody() {
    const {configId, eventConfigId, onSelect} = this.props;
    const {configs} = this.state;

    const options = configs
      .filter(config => !config.hidden || config.id === eventConfigId)
      .map(({id}) => ({
        value: id,
        label: (
          <GroupingConfigItem active={id === eventConfigId}>{id}</GroupingConfigItem>
        ),
      }));

    // TODO(grouping): should we use other select component?
    return (
      <DropdownAutoComplete
        value={configId}
        onSelect={onSelect}
        alignMenu="left"
        selectedItem={configId}
        items={options}
      >
        {({isOpen}) => (
          <Tooltip title={t('Click here to experiment with other grouping configs')}>
            <DropdownButton isOpen={isOpen} size="small" style={{fontWeight: 'inherit'}}>
              <GroupingConfigItem active={eventConfigId === configId}>
                {configId}
              </GroupingConfigItem>
            </DropdownButton>
          </Tooltip>
        )}
      </DropdownAutoComplete>
    );
  }
}

export default GroupingConfigSelect;
