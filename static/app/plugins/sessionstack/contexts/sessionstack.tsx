import {Component} from 'react';
import {findDOMNode} from 'react-dom';

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
    // eslint-disable-next-line react/no-find-dom-node
    const domNode = findDOMNode(this) as HTMLElement;
    this.parentNode = domNode.parentNode as HTMLElement;
    window.addEventListener('resize', () => this.setIframeSize(), false);
    this.setIframeSize();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', () => this.setIframeSize(), false);
  }
  parentNode?: HTMLElement;

  getTitle = () => 'SessionStack';

  setIframeSize() {
    if (this.state.showIframe || !this.parentNode) {
      return;
    }

    const parentWidth = this.parentNode.clientWidth;

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

export default SessionStackContextType;
