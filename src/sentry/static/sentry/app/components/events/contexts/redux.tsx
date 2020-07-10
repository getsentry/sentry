import React from 'react';

import {t} from 'app/locale';
import ContextBlock from 'app/components/events/contexts/contextBlock';
import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';

type Props = {
  alias: string;
  data: Record<string, any>;
};

class ReduxContextType extends React.Component<Props> {
  getKnownData(): KeyValueListData[] {
    return [
      {
        key: 'value',
        subject: t('Value'),
        value: this.props.data,
      },
    ];
  }

  render() {
    return <ContextBlock knownData={this.getKnownData()} />;
  }
}

export default ReduxContextType;
