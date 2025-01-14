import {Component} from 'react';

import {uniqueId} from 'sentry/utils/guid';

const ASPECT_RATIO = 16 / 9;

type Props = {
  data: {
    session_url?: string;
  };
};

type State = {
  showIframe: boolean;
  height?: number;
  width?: number;
};

class SessionStackContextType extends Component<Props, State> {
  state: State = {
    showIframe: false,
  };

  componentDidMount() {
    window.addEventListener('resize', () => this.setIframeSize(), false);
    this.setIframeSize();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', () => this.setIframeSize(), false);
  }
  iframeContainerId = uniqueId();

  getTitle = () => 'SessionStack';

  setIframeSize() {
    const parentNode = document.getElementById(this.iframeContainerId)?.parentElement;
    if (!this.state.showIframe || !parentNode) {
      return;
    }

    const parentWidth = parentNode.clientWidth;

    this.setState({
      width: parentWidth,
      height: parentWidth / ASPECT_RATIO,
    });
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
      <div className="panel-group" id={this.iframeContainerId}>
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

export default SessionStackContextType;
