import React from 'react';

import GroupEventDataSection from './eventDataSection';
import PropTypes from '../../proptypes';
import {t} from '../../locale';

const DeviceInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired
  },

  getInitialState() {
    return {};
  },

  render() {
    let {group, event} = this.props;
    let data = event.device;
    let extras = Object.keys(data.data || {}).map((key) => {
      let value = data.data[key];
      return (
        <tr key={key}>
          <td className="key">{key}</td>
          <td className="value"><pre>{value}</pre></td>
        </tr>
      );
    });

    return (
      <GroupEventDataSection
        group={group}
        event={event}
        type="device"
        title={t('Device')}
        wrapTitle={true}>
        <table className="table key-value">
          <tbody>
            {data.name &&
              <tr>
                <td className="key">Name</td>
                <td className="value"><pre>{data.name}</pre></td>
              </tr>}
            {data.version && 
              <tr>
                <td className="key">Version</td>
                <td className="value"><pre>{data.version}</pre></td>
              </tr>}
            {data.build &&
              <tr>
                <td className="key">Build</td>
                <td className="value"><pre>{data.build}</pre></td>
              </tr>}
            {extras}
          </tbody>
        </table>
      </GroupEventDataSection>
    );
  }
});

export default DeviceInterface;
