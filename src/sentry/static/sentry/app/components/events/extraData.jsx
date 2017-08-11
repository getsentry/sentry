import React from 'react';

import PropTypes from '../../proptypes';
import {objectToArray} from '../../utils';
import ContextData from '../contextData';
import EventDataSection from './eventDataSection';
import KeyValueList from './interfaces/keyValueList';
import {t} from '../../locale';

const EventExtraData = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired
  },

  getInitialState() {
    return {
      raw: false
    };
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id || this.state.raw !== nextState.raw;
  },

  toggleRaw(shouldBeRaw) {
    this.setState({
      raw: !this.state.raw
    });
  },

  renderRaw() {
    let extraRawData = JSON.stringify(this.props.event.context);
    // extraRawData = [extraRawData];
    return (
      <table className="table key-value">
        <tbody>
          <tr>
            <td className="value">
              <ContextData data={extraRawData} />
            </td>
          </tr>
        </tbody>
      </table>
    );
  },

  renderPretty() {
    let extraDataArray = objectToArray(this.props.event.context);
    return <KeyValueList data={extraDataArray} isContextData={true} />;
  },

  render() {
    return (
      <div>
        <EventDataSection
          group={this.props.group}
          event={this.props.event}
          type="extra"
          title={t('Additional Data')}>
          <div className="btn-group">
            <a
              className={(!this.state.raw ? 'active' : '') + ' btn btn-default btn-sm'}
              onClick={this.toggleRaw}>
              {t('Formatted')}
            </a>
            <a
              className={(this.state.raw ? 'active' : '') + ' btn btn-default btn-sm'}
              onClick={this.toggleRaw}>
              {t('Raw')}
            </a>
          </div>
          {this.state.raw ? this.renderRaw() : this.renderPretty()}
        </EventDataSection>
      </div>
    );
  }
});

export default EventExtraData;
