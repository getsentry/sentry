import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import {t} from 'app/locale';

class ClippedBox extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    defaultClipped: PropTypes.bool,
    clipHeight: PropTypes.number,
    btnClassName: PropTypes.string,
    btnText: PropTypes.string,
  };

  static defaultProps = {
    defaultClipped: false,
    clipHeight: 200,
    renderedHeight: null,
    btnClassName: 'btn btn-primary btn-xs show-more',
    btnText: t('Show More'),
  };

  constructor(...args) {
    super(...args);
    this.state = {
      clipped: this.props.defaultClipped,
      revealed: false, // True once user has clicked "Show More" button
    };
  }

  componentDidMount() {
    let renderedHeight = ReactDOM.findDOMNode(this).offsetHeight;

    if (!this.state.clipped && renderedHeight > this.props.clipHeight) {
      /*eslint react/no-did-mount-set-state:0*/
      // okay if this causes re-render; cannot determine until
      // rendered first anyways
      this.setState({
        clipped: true,
      });
    }
  }

  reveal = e => {
    e.stopPropagation();

    this.setState({
      clipped: false,
      revealed: true,
    });
  };

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
        style={{maxHeight: this.state.clipped ? this.props.clipHeight : null}}
      >
        {this.props.title && <h5>{this.props.title}</h5>}
        {this.props.children}

        {this.state.clipped && (
          <div className="clip-fade">
            <a onClick={this.reveal} className={this.props.btnClassName}>
              {this.props.btnText}
            </a>
          </div>
        )}
      </div>
    );
  }
}

export default ClippedBox;
