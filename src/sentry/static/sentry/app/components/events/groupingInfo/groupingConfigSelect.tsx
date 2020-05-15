import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import Tooltip from 'app/components/tooltip';

class GroupingConfigSelect extends AsyncComponent {
  static propTypes = {
    eventConfigId: PropTypes.string,
    configId: PropTypes.string,
  };

  getEndpoints() {
    return [['data', '/grouping-configs/']];
  }

  renderBody() {
    const {configId, eventConfigId, ...props} = this.props;
    props.value = configId;

    function renderIdLabel(id) {
      return <GroupingConfigItem active={eventConfigId === id}>{id}</GroupingConfigItem>;
    }

    return (
      <DropdownAutoComplete
        {...props}
        alignMenu="left"
        selectedItem={configId}
        items={this.state.data
          .filter(item => !item.hidden || item.id === eventConfigId)
          .map(item => ({
            value: item.id,
            label: renderIdLabel(item.id),
          }))}
      >
        {({isOpen}) => (
          <Tooltip title="Click here to experiment with other grouping configs">
            <DropdownButton isOpen={isOpen} size="small" style={{fontWeight: 'inherit'}}>
              {renderIdLabel(configId)}
            </DropdownButton>
          </Tooltip>
        )}
      </DropdownAutoComplete>
    );
  }
}

export const GroupingConfigItem = styled(
  ({hidden: _hidden, active: _active, ...props}) => <code {...props} />
)`
  ${p => (p.hidden ? 'opacity: 0.5;' : '')}
  ${p => (p.active ? 'font-weight: bold;' : '')}
`;

export default GroupingConfigSelect;
