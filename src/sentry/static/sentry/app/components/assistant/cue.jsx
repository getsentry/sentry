import PropTypes from 'prop-types';
import React from 'react';

class AssistantCue extends React.Component {
  static propTypes = {
    text: PropTypes.string,
    onClick: PropTypes.func.isRequired,
  };

  render() {
    return (
      <div onClick={this.props.onClick} className="assistant-cue">
        {this.props.text}
      </div>
    );
  }
}

export default AssistantCue;
