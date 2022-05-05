import {Component} from 'react';
import upperFirst from 'lodash/upperFirst';

import ClippedBox from 'sentry/components/clippedBox';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {t} from 'sentry/locale';

type KeyValueListData = React.ComponentProps<typeof ContextBlock>['data'];

type StateDescription = {
  value: Record<string, any>;
  type?: string;
};

type Props = {
  alias: string;
  data: {
    [state: string]: StateDescription;
    state: StateDescription;
  };
};

class StateContextType extends Component<Props> {
  getStateTitle(name: string, type?: string) {
    return `${name}${type ? ` (${upperFirst(type)})` : ''}`;
  }

  getKnownData(): KeyValueListData {
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

  getUnknownData(): KeyValueListData {
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
