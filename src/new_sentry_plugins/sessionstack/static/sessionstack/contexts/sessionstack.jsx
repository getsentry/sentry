import React from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";

const ASPECT_RATIO = 16 / 9;

class SessionStackContextType extends React.Component {
  static propTypes() {
    return {
      alias: PropTypes.string.isRequired,
      data: PropTypes.object.isRequired
    };
  }

  constructor(props) {
    super(props);
    this.state = {
      showIframe: false
    };
  }

  componentDidMount() {
    this.parentNode = ReactDOM.findDOMNode(this).parentNode;
    window.addEventListener("resize", () => this.setIframeSize(), false);
    this.setIframeSize();
  }

  componentWillUnmount() {
    window.removeEventListener("resize", () => this.setIframeSize(), false);
  }

  setIframeSize() {
    if (!this.showIframe) {
      let parentWidth = $(this.parentNode).width();

      this.setState({
        width: parentWidth,
        height: parentWidth / ASPECT_RATIO
      });
    }
  }

  playSession() {
    this.setState({
      showIframe: true
    });

    this.setIframeSize();
  }

  render() {
    let { session_url } = this.props.data;

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

SessionStackContextType.getTitle = function(value) {
  return "SessionStack";
};

export default SessionStackContextType;
