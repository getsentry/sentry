import React from 'react';
import createReactClass from 'create-react-class';
import classNames from 'classnames';

const DugoutHandle = createReactClass({
  getInitialState(props) {
    return {
      isOpen: false,
    };
  },

  clickedHandle() {
    this.setState({isOpen: !this.state.isOpen});
  },

  render() {
    return (
      <div
        onClick={this.clickedHandle}
        className={classNames('dugout-drawer', {
          'dugout-drawer--engaged': this.state.isOpen,
        })}
      >
        <div className="dugout-message">Need Help?</div>
      </div>
    );
  },
});

export default DugoutHandle;
