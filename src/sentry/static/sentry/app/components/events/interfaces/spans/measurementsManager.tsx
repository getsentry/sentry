import React from 'react';

export type MeasurementsManagerChildrenProps = {
  hoveringMeasurement: (measurementName: string) => void;
  notHovering: () => void;
  currentHoveredMeasurement: string | undefined;
};

const MeasurementsManagerContext = React.createContext<MeasurementsManagerChildrenProps>({
  hoveringMeasurement: () => {},
  notHovering: () => {},
  currentHoveredMeasurement: undefined,
});

type Props = {
  children: React.ReactNode;
};

type State = {
  currentHoveredMeasurement: string | undefined;
};

export class Provider extends React.Component<Props, State> {
  state: State = {
    currentHoveredMeasurement: undefined,
  };

  hoveringMeasurement = (measurementName: string) => {
    this.setState({
      currentHoveredMeasurement: measurementName,
    });
  };

  notHovering = () => {
    this.setState({
      currentHoveredMeasurement: undefined,
    });
  };

  render() {
    const childrenProps = {
      hoveringMeasurement: this.hoveringMeasurement,
      notHovering: this.notHovering,
      currentHoveredMeasurement: this.state.currentHoveredMeasurement,
    };

    return (
      <MeasurementsManagerContext.Provider value={childrenProps}>
        {this.props.children}
      </MeasurementsManagerContext.Provider>
    );
  }
}

export const Consumer = MeasurementsManagerContext.Consumer;
