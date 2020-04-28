import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';

import {t} from 'app/locale';
import Button from 'app/components/button';

class ClippedBox extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    defaultClipped: PropTypes.bool,
    clipHeight: PropTypes.number,
    btnText: PropTypes.string,
  };

  static defaultProps = {
    defaultClipped: false,
    clipHeight: 200,
    renderedHeight: null,
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
    const renderedHeight = ReactDOM.findDOMNode(this).offsetHeight; // eslint-disable-line react/no-find-dom-node

    if (!this.state.clipped && renderedHeight > this.props.clipHeight) {
      /*eslint react/no-did-mount-set-state:0*/
      // okay if this causes re-render; cannot determine until
      // rendered first anyways
      this.setState({
        clipped: true,
      });
    }
  }

  componentDidUpdate() {
    if (this.state.revealed || !this.state.clipped) {
      return;
    }

    const renderedHeight = ReactDOM.findDOMNode(this).offsetHeight; // eslint-disable-line react/no-find-dom-node
    if (renderedHeight < this.props.clipHeight) {
      this.reveal();
    }
  }

  reveal = e => {
    e?.stopPropagation();

    this.setState({
      clipped: false,
      revealed: true,
    });
  };

  render() {
    const className = classnames('box-clippable', {
      clipped: this.state.clipped,
      revealed: this.state.revealed,
    });

    return (
      <div
        className={className}
        style={{maxHeight: this.state.clipped ? this.props.clipHeight : null}}
      >
        {this.props.title && <h5>{this.props.title}</h5>}
        {this.props.children}

        {this.state.clipped && (
          <div className="clip-fade">
            <Button onClick={this.reveal} priority="primary" size="xsmall">
              {this.props.btnText}
            </Button>
          </div>
        )}
      </div>
    );
  }
}

export default ClippedBox;
