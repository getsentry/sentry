import React from 'react';

type ChildProps = {
  handleShow: () => void;
};

type Props = {
  children: (childProps: ChildProps) => React.ReactNode;
};

type State = {
  isShowing: boolean;
};

class FeatureTourModal extends React.Component<Props> {
  state: State = {
    isShowing: false,
  };

  handleShow = () => {
    this.setState({isShowing: true});
  };

  render() {
    const {children} = this.props;
    const {isShowing} = this.state;

    const childProps = {
      handleShow: this.handleShow,
    };
    if (isShowing) {
      return <div>I am showing!</div>;
    }
    return children(childProps);
  }
}

export default FeatureTourModal;
