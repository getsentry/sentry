import React from "react";

var ClippedBox = React.createClass({
  propTypes: {
    title: React.PropTypes.string.isRequired,
    defaultClipped: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      defaultClipped: false,
      clipHeight: 200
    };
  },

  getInitialState() {
    return {
      clipped: this.props.defaultClipped
    };
  },

  componentDidMount() {
    var renderedHeight = this.getDOMNode().offsetHeight;

    if (renderedHeight > this.props.clipHeight ) {
      this.setState({
        clipped: true
      });
    }
  },

  reveal() {
    this.setState({
      clipped: false
    });
  },

  render() {
    var className = "box-clippable";
    if (this.state.clipped) {
      className += " clipped";
    }

    return (
      <div className={className}>
        {this.props.title &&
          <h5>{this.props.title}</h5>
        }
        {this.props.children}
        <div className="clip-fade">
          <a onClick={this.reveal} className="show-more btn btn-primary btn-xs">Show more</a>
        </div>
      </div>
    );
  }
});

export default ClippedBox;
