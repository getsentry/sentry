import {Component} from 'react';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EventDataSection from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {t} from 'sentry/locale';

function getView(view: View, data: State['data']) {
  switch (view) {
    case 'report':
      return (
        <KeyValueList
          data={Object.entries(data).map(([key, value]) => ({
            key,
            value,
            subject: key,
            meta: getMeta(data, key),
          }))}
          isContextData
        />
      );
    case 'raw':
      return <pre>{JSON.stringify({'csp-report': data}, null, 2)}</pre>;
    default:
      throw new TypeError(`Invalid view: ${view}`);
  }
}

type Props = {
  data: Record<string, any>;
  type: string;
};

type View = 'report' | 'raw';

type State = {
  view: View;
} & Pick<Props, 'data'>;

export default class GenericInterface extends Component<Props, State> {
  state: State = {
    view: 'report',
    data: this.props.data,
  };

  toggleView = (value: View) => {
    this.setState({
      view: value,
    });
  };

  render() {
    const {view, data} = this.state;
    const {type} = this.props;

    const title = (
      <div>
        <ButtonBar merged active={view}>
          <Button barId="report" size="xs" onClick={this.toggleView.bind(this, 'report')}>
            {t('Report')}
          </Button>
          <Button barId="raw" size="xs" onClick={this.toggleView.bind(this, 'raw')}>
            {t('Raw')}
          </Button>
        </ButtonBar>
        <h3>{t('Report')}</h3>
      </div>
    );

    const children = getView(view, data);

    return (
      <EventDataSection type={type} title={title} wrapTitle={false}>
        {children}
      </EventDataSection>
    );
  }
}
