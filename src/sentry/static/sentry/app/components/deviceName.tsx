import PropTypes from 'prop-types';
import React from 'react';
import {IOSDeviceList} from 'app/types/iOSDeviceList';

export function deviceNameMapper(model: string, iOSDeviceList): string {
  const modelIdentifier = model.split(' ')[0];
  const modelId = model
    .split(' ')
    .splice(1)
    .join(' ');
  const modelName = iOSDeviceList.generationByIdentifier(modelIdentifier);
  return modelName === undefined ? model : modelName + ' ' + modelId;
}

export async function loadDeviceListModule() {
  return import(/* webpackChunkName: "iOSDeviceList" */ 'ios-device-list');
}

type Props = {
  children?: string;
};

type State = {
  iOSDeviceList: IOSDeviceList | null;
};
/**
 * This is used to map iOS Device Names to model name.
 * This asynchronously loads the ios-device-list library because of its size
 */
export default class DeviceName extends React.Component<Props, State> {
  static propTypes = {
    children: PropTypes.string,
  };

  constructor(props) {
    super(props);

    this.state = {
      iOSDeviceList: null,
    };
  }

  private _isMounted?: boolean;

  componentDidMount() {
    // This is to handle react's warning on calling setState for unmounted components
    // Since we can't cancel promises, we need to do this
    this._isMounted = true;

    // This library is very big, so we are codesplitting it based on size and
    // the relatively small utility this library provides
    loadDeviceListModule().then(iOSDeviceList => {
      if (!this._isMounted) {
        return;
      }

      this.setState({iOSDeviceList});
    });
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    const {children} = this.props;
    const {iOSDeviceList} = this.state;

    // Children can be undefined, need to return null or else react throws
    if (!children) {
      return null;
    }

    // If library has not loaded yet, then just render the raw model string, better than empty
    if (!iOSDeviceList) {
      return children;
    }

    return (
      <span data-test-id="loaded-device-name">
        {deviceNameMapper(children, iOSDeviceList)}
      </span>
    );
  }
}
