import PropTypes from 'prop-types';
import React from 'react';
import {isString} from 'lodash';

export function deviceNameMapper(model, iOSDeviceList) {
  if (!model || !isString(model)) {
    return null;
  }
  const modelIdentifier = model.split(' ')[0];
  const modelId = model
    .split(' ')
    .splice(1)
    .join(' ');
  const modelName = iOSDeviceList.generationByIdentifier(modelIdentifier);
  return modelName === undefined ? model : modelName + ' ' + modelId;
}

export async function loadDeviceListModule() {
  return import(/*webpackChunkName: "iOSDeviceList"*/ 'ios-device-list');
}

export async function getDeviceName(model) {
  const iOSDeviceList = await loadDeviceListModule();

  return deviceNameMapper(model, iOSDeviceList);
}

/**
 * This is used to map iOS Device Names to model name.
 * This asynchronously loads the ios-device-list library because of its size
 */
export default class DeviceName extends React.Component {
  static propTypes = {
    children: PropTypes.string,
  };

  constructor(...args) {
    super(...args);

    this.state = {
      iOSDeviceList: null,
    };
  }

  componentDidMount() {
    // This library is very big, so we are codesplitting it based on size and
    // the relatively small utility this library provides
    loadDeviceListModule().then(iOSDeviceList => this.setState({iOSDeviceList}));
  }

  render() {
    let {iOSDeviceList} = this.state;

    // If library has not loaded yet, then just render the raw model string, better than empty
    if (!iOSDeviceList) return this.props.children;

    return deviceNameMapper(this.props.children, iOSDeviceList);
  }
}
