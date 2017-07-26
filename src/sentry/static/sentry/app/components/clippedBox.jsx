import React from 'react';
import ReactDOM from 'react-dom';
import {t} from '../locale';

const ClippedBox = React.createClass({
  propTypes: {
    title: React.PropTypes.string,
    defaultClipped: React.PropTypes.bool,
    clipHeight: React.PropTypes.number,
    btnClassName: React.PropTypes.string,
    btnText: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      defaultClipped: false,
      clipHeight: 200,
      renderedHeight: null,
      btnClassName: 'btn btn-primary btn-xs show-more',
      btnText: t('Show More')
    };
  },

  getInitialState() {
    return {
      clipped: this.props.defaultClipped,
      revealed: false // True once user has clicked "Show More" button
    };
  },

  componentDidMount() {
    let renderedHeight = ReactDOM.findDOMNode(this).offsetHeight;

    if (!this.state.clipped && renderedHeight > this.props.clipHeight) {
      /*eslint react/no-did-mount-set-state:0*/
      // okay if this causes re-render; cannot determine until
      // rendered first anyways
      this.setState({
        clipped: true
      });
    }
  },

  reveal(e) {
    e.stopPropagation();

    this.setState({
      clipped: false,
      revealed: true
    });
  },

  render() {
    let className = 'box-clippable';
    if (this.state.clipped) {
      className += ' clipped';
    }
    if (this.state.revealed) {
      className += ' revealed';
    }

    return (
      <div
        className={className}
        style={{maxHeight: this.state.clipped ? this.props.clipHeight : null}}>
        {this.props.title && <h5>{this.props.title}</h5>}
        {this.props.children}

        {this.state.clipped &&
          <div className="clip-fade">
            <a onClick={this.reveal} className={this.props.btnClassName}>
              {this.props.btnText}
            </a>
          </div>}
      </div>
    );
  }
});

export default ClippedBox;
