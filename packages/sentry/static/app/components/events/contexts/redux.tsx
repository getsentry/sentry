import {Component} from 'react';

import ClippedBox from 'sentry/components/clippedBox';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';

type KeyValueListData = React.ComponentProps<typeof ContextBlock>['data'];

import {t} from 'sentry/locale';

type Props = {
  alias: string;
  data: Record<string, any>;
};

class ReduxContextType extends Component<Props> {
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
