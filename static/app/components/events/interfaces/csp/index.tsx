import {Component} from 'react';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EventDataSection from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';

import Content from './content';
import Help from './help';

function getView(view, data) {
  switch (view) {
    case 'report':
      return <Content data={data} />;
    case 'raw':
      return <pre>{JSON.stringify({'csp-report': data}, null, 2)}</pre>;
    case 'help':
      return <Help data={data} />;
    default:
      throw new TypeError(`Invalid view: ${view}`);
  }
}

type Props = {
  data: Record<string, any>;
  event: Event;
};

type State = {
  view: string;
};

class CspInterface extends Component<Props, State> {
  state: State = {view: 'report'};

  toggleView = value => {
    this.setState({
      view: value,
    });
  };

  render() {
    const {view} = this.state;
    const {data} = this.props;

    const cleanData =
      data.original_policy !== 'string'
        ? data
        : {
            ...data,
            // Hide the report-uri since this is redundant and silly
            original_policy: data.original_policy.replace(/(;\s+)?report-uri [^;]+/, ''),
          };

    const actions = (
      <ButtonBar merged active={view}>
        <Button barId="report" size="xs" onClick={this.toggleView.bind(this, 'report')}>
          {t('Report')}
        </Button>
        <Button barId="raw" size="xs" onClick={this.toggleView.bind(this, 'raw')}>
          {t('Raw')}
        </Button>
        <Button barId="help" size="xs" onClick={this.toggleView.bind(this, 'help')}>
          {t('Help')}
        </Button>
      </ButtonBar>
    );

    const children = getView(view, cleanData);

    return (
      <EventDataSection
        type="csp"
        title={<h3>{t('CSP Report')}</h3>}
        actions={actions}
        wrapTitle={false}
      >
        {children}
      </EventDataSection>
    );
  }
}

export default CspInterface;
