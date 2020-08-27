import React from 'react';

import {t} from 'app/locale';
import ContextBlock from 'app/components/events/contexts/contextBlock';
import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import ClippedBox from 'app/components/clippedBox';

type Props = {
  alias: string;
  data: Record<string, any>;
};

class ReduxContextType extends React.Component<Props> {
  getKnownData(): KeyValueListData[] {
    return [
      {
        key: 'value',
        subject: t('Latest State'),
        value: this.props.data,
      },
    ];
  }

  render() {
    return (
      <ClippedBox clipHeight={250}>
        <ContextBlock data={this.getKnownData()} />
      </ClippedBox>
    );
  }
}

export default ReduxContextType;
