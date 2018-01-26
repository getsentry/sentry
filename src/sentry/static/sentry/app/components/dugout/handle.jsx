import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

const DugoutHandle = createReactClass({
  propTypes: {
    cue: PropTypes.string,
    onClick: PropTypes.func.isRequired,
  },

  render() {
    return (
      <div onClick={this.props.onClick} className="dugout-cue">
        {this.props.cue}
      </div>
    );
  },
});

export default DugoutHandle;
