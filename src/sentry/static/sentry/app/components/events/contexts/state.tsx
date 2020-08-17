import React from 'react';
import upperFirst from 'lodash/upperFirst';

import {t} from 'app/locale';
import ContextBlock from 'app/components/events/contexts/contextBlock';
import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import ClippedBox from 'app/components/clippedBox';
import {getMeta} from 'app/components/events/meta/metaProxy';

type StateDescription = {
  type?: string;
  value: Record<string, any>;
};

type Props = {
  alias: string;
  data: {
    state: StateDescription;
    [state: string]: StateDescription;
  };
};

class StateContextType extends React.Component<Props> {
  getStateTitle(name: string, type?: string) {
    return `${name}${type ? ` (${upperFirst(type)})` : ''}`;
  }

  getKnownData(): KeyValueListData[] {
    const primaryState = this.props.data.state;

    if (!primaryState) {
      return [];
    }

    return [
      {
        key: 'state',
        subject: this.getStateTitle(t('State'), primaryState.type),
        value: primaryState.value,
      },
    ];
  }

  getUnknownData(): KeyValueListData[] {
    const {data} = this.props;

    return Object.entries(data)
      .filter(([key]) => !['type', 'title', 'state'].includes(key))
      .map(([name, state]) => ({
        key: name,
        value: state.value,
        subject: this.getStateTitle(name, state.type),
        meta: getMeta(data, name),
      }));
  }

  render() {
    return (
      <ClippedBox clipHeight={250}>
        <ContextBlock data={this.getKnownData()} />
        <ContextBlock data={this.getUnknownData()} />
      </ClippedBox>
    );
  }
}

export default StateContextType;
