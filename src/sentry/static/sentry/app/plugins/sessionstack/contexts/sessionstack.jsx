import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

const ASPECT_RATIO = 16 / 9;

class SessionStackContextType extends React.Component {
  propTypes = {
    data: PropTypes.object.isRequired,
  };

  state = {
    showIframe: false,
  };

  componentDidMount() {
    // eslint-disable-next-line react/no-find-dom-node
    this.parentNode = ReactDOM.findDOMNode(this).parentNode;
    window.addEventListener('resize', () => this.setIframeSize(), false);
    this.setIframeSize();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', () => this.setIframeSize(), false);
  }

  setIframeSize() {
    if (!this.showIframe) {
      const parentWidth = $(this.parentNode).width();

      this.setState({
        width: parentWidth,
        height: parentWidth / ASPECT_RATIO,
      });
    }
  }

  playSession() {
    this.setState({
      showIframe: true,
    });

    this.setIframeSize();
  }

  render() {
    const {session_url} = this.props.data;

    if (!session_url) {
      return <h4>Session not found.</h4>;
    }

    return (
      <div className="panel-group">
        {this.state.showIframe ? (
          <iframe
            src={session_url}
            sandbox="allow-scripts allow-same-origin"
            width={this.state.width}
            height={this.state.height}
          />
        ) : (
          <button
            className="btn btn-default"
            type="button"
            onClick={() => this.playSession()}
          >
            Play session
          </button>
        )}
      </div>
    );
  }
}

SessionStackContextType.getTitle = () => 'SessionStack';

export default SessionStackContextType;
