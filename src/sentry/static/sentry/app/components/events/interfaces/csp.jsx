import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from 'app/sentryTypes';
import ButtonBar from 'app/components/buttonBar';
import Button from 'app/components/button';
import EventDataSection from 'app/components/events/eventDataSection';
import CSPContent from 'app/components/events/interfaces/cspContent';
import CSPHelp from 'app/components/events/interfaces/cspHelp';
import {t} from 'app/locale';

function getView(view, data) {
  switch (view) {
    case 'report':
      return <CSPContent data={data} />;
    case 'raw':
      return <pre>{JSON.stringify({'csp-report': data}, null, 2)}</pre>;
    case 'help':
      return <CSPHelp data={data} />;
    default:
      throw new TypeError(`Invalid view: ${view}`);
  }
}

export default class CspInterface extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    data: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    const {data} = props;
    // hide the report-uri since this is redundant and silly
    data.original_policy = data.original_policy.replace(/(;\s+)?report-uri [^;]+/, '');

    this.state = {
      view: 'report',
      data,
    };
  }

  toggleView = value => {
    this.setState({
      view: value,
    });
  };

  render() {
    const {view, data} = this.state;
    const {event} = this.props;

    const title = (
      <div>
        <ButtonBar merged active={view}>
          <Button
            barId="report"
            size="xsmall"
            onClick={this.toggleView.bind(this, 'report')}
          >
            {t('Report')}
          </Button>
          <Button barId="raw" size="xsmall" onClick={this.toggleView.bind(this, 'raw')}>
            {t('Raw')}
          </Button>
          <Button barId="help" size="xsmall" onClick={this.toggleView.bind(this, 'help')}>
            {t('Help')}
          </Button>
        </ButtonBar>
        <h3>{t('CSP Report')}</h3>
      </div>
    );

    const children = getView(view, data);

    return (
      <EventDataSection event={event} type="csp" title={title} wrapTitle={false}>
        {children}
      </EventDataSection>
    );
  }
}
