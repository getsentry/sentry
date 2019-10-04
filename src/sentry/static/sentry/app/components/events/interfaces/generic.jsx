import PropTypes from 'prop-types';
import React, {Component} from 'react';
import SentryTypes from 'app/sentryTypes';

import EventDataSection from 'app/components/events/eventDataSection';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import {t} from 'app/locale';

function getView(view, data) {
  switch (view) {
    case 'report':
      return <KeyValueList data={Object.entries(data)} isContextData />;
    case 'raw':
      return <pre>{JSON.stringify({'csp-report': data}, null, 2)}</pre>;
    default:
      throw new TypeError(`Invalid view: ${view}`);
  }
}
export default class GenericInterface extends Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    type: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    const {data} = props;
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
    const {event, type} = this.props;

    const title = (
      <div>
        <div className="btn-group">
          <a
            className={(view === 'report' ? 'active' : '') + ' btn btn-default btn-sm'}
            onClick={this.toggleView.bind(this, 'report')}
          >
            {t('Report')}
          </a>
          <a
            className={(view === 'raw' ? 'active' : '') + ' btn btn-default btn-sm'}
            onClick={this.toggleView.bind(this, 'raw')}
          >
            {t('Raw')}
          </a>
        </div>
        <h3>{t('Report')}</h3>
      </div>
    );

    const children = getView(view, data);

    return (
      <EventDataSection event={event} type={type} title={title} wrapTitle={false}>
        {children}
      </EventDataSection>
    );
  }
}
