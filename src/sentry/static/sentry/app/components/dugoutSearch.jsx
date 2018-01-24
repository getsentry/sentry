// import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import classNames from 'classnames';

const DugoutSearch = createReactClass({
  displayName: 'DugoutSearch',

  getInitialState(props) {
    return {
      isOpen: false,
    };
  },

  clickedHandle() {
    let isOpen = this.state.isOpen;
    this.setState({isOpen: !isOpen});
  },

  render() {
    let {isOpen} = this.state;

    return (
      <div>
        <div
          onClick={this.clickedHandle}
          className={classNames('dugout-drawer', {
            'dugout-drawer--engaged': isOpen,
          })}
        >
          {!isOpen ? (
            <div className="dugout-message">Need Help?</div>
          ) : (
            <div className="dugout-message-large">
              <div className="dugout-message-large-title">
                What do you need help with...
              </div>
              {/* {gsSearch Placeholder}  */}
            </div>
          )}
        </div>
      </div>
    );
  },
});

export default DugoutSearch;
