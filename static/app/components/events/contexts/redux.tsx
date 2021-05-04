import * as React from 'react';

import ClippedBox from 'app/components/clippedBox';
import ContextBlock from 'app/components/events/contexts/contextBlock';

type KeyValueListData = React.ComponentProps<typeof ContextBlock>['data'];

import {t} from 'app/locale';

type Props = {
  alias: string;
  data: Record<string, any>;
};

class ReduxContextType extends React.Component<Props> {
  getKnownData(): KeyValueListData {
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
