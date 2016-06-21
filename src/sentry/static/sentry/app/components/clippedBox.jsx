import React from 'react';
import ReactDOM from 'react-dom';
import {t} from '../locale';

const ClippedBox = React.createClass({
  propTypes: {
    title: React.PropTypes.string,
    defaultClipped: React.PropTypes.bool,
    clipHeight: React.PropTypes.number
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
    let renderedHeight = ReactDOM.findDOMNode(this).offsetHeight;

    if (renderedHeight > this.props.clipHeight ) {
      /*eslint react/no-did-mount-set-state:0*/
      // okay if this causes re-render; cannot determine until
      // rendered first anyways
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
    let className = 'box-clippable';
    if (this.state.clipped) {
      className += ' clipped';
    }

    return (
      <div className={className}>
        {this.props.title &&
          <h5>{this.props.title}</h5>
        }
        {this.props.children}
        <div className="clip-fade">
          <a onClick={this.reveal} className="show-more btn btn-primary btn-xs">
            {t('Show more')}
          </a>
        </div>
      </div>
    );
  }
});

export default ClippedBox;
