import {Component} from 'react';

import CustomMeasurementsStore from 'sentry/stores/customMeasurementsStore';
import getDisplayName from 'sentry/utils/getDisplayName';
import {MeasurementCollection} from 'sentry/utils/measurements/measurements';

type InjectedCustomMeasurementsProps = {
  customMeasurements: MeasurementCollection;
};

type State = {
  customMeasurements: MeasurementCollection;
};

/**
 * HOC for getting Custom Measurements from the CustomMeasurementsStore.
 */
function withCustomMeasurements<P extends InjectedCustomMeasurementsProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithCustomMeasurements extends Component<
    Omit<P, keyof InjectedCustomMeasurementsProps>,
    State
  > {
    static displayName = `withCustomMeasurements(${getDisplayName(WrappedComponent)})`;

    state: State = {
      customMeasurements: CustomMeasurementsStore.getAllCustomMeasurements(),
    };

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = CustomMeasurementsStore.listen(
      (customMeasurements: MeasurementCollection) => this.setState({customMeasurements}),
      undefined
    );

    render() {
      const {customMeasurements, ...props} = this.props as P;
      return (
        <WrappedComponent
          {...({
            customMeasurements: customMeasurements ?? this.state.customMeasurements,
            ...props,
          } as P)}
        />
      );
    }
  }

  return WithCustomMeasurements;
}

export default withCustomMeasurements;
