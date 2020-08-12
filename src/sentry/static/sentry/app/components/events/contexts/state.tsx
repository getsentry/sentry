import React from 'react';
import upperFirst from 'lodash/upperFirst';

import {t} from 'app/locale';
import ContextBlock from 'app/components/events/contexts/contextBlock';
import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import ClippedBox from 'app/components/clippedBox';

import getUnknownData from './getUnknownData';

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
  getKnownData(): KeyValueListData[] {
    const primaryState = this.props.data.state;

    return [
      {
        key: 'state',
        subject:
          t('State') + (primaryState.type ? ` (${upperFirst(primaryState.type)})` : ''),
        value: primaryState.value,
      },
    ];
  }

  render() {
    const {data} = this.props;

    return (
      <ClippedBox clipHeight={250}>
        <ContextBlock data={this.getKnownData()} />
        <ContextBlock data={getUnknownData(data, ['state'])} />
      </ClippedBox>
    );
  }
}

export default StateContextType;
