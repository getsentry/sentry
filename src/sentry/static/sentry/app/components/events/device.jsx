import React from 'react';

import GroupEventDataSection from './eventDataSection';
import PropTypes from '../../proptypes';
import {t} from '../../locale';
import ContextData from '../contextData';

// TODO(hazat): Is this interface used somewhere? If not delete it? 
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
          <td className="value"><ContextData data={value} /></td>
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
            {data.model &&
              <tr>
                <td className="key">Model</td>
                <td className="value"><pre>{data.model}</pre></td>
              </tr>}
            {data.model_id && 
              <tr>
                <td className="key">Model ID</td>
                <td className="value"><pre>{data.model_id}</pre></td>
              </tr>}
            {data.os &&
              <tr>
                <td className="key">OS</td>
                <td className="value"><pre>{data.os}</pre></td>
              </tr>}
            {data.os_version &&
              <tr>
                <td className="key">OS Version</td>
                <td className="value"><pre>{data.os_version}</pre></td>
              </tr>}
            {data.os_build &&
              <tr>
                <td className="key">OS Build</td>
                <td className="value"><pre>{data.os_build}</pre></td>
              </tr>}
            {data.arch &&
              <tr>
                <td className="key">CPU Architecture</td>
                <td className="value"><pre>{data.arch}</pre></td>
              </tr>}
            {extras}
          </tbody>
        </table>
      </GroupEventDataSection>
    );
  }
});

export default DeviceInterface;
