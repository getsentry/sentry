import {Component} from 'react';

interface RedirectPageState {
  count: number;
  redirectUrl: string | null;
}

class RedirectPage extends Component<{}, RedirectPageState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      count: 5,
      redirectUrl: null,
    };
  }

  componentDidMount() {
    const queryParams = new URLSearchParams(window.location.search);
    const redirectUrl = queryParams.get('url');

    if (redirectUrl) {
      this.setState({redirectUrl});
    }

    this.timer = window.setInterval(() => {
      this.setState(prevState => ({
        count: prevState.count - 1,
      }));
    }, 1000);
  }

  componentDidUpdate() {
    const {count, redirectUrl} = this.state;
    if (count === 0 && redirectUrl) {
      if (this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
        window.location.href = redirectUrl;
      }
    }
  }

  componentWillUnmount() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  timer: number | null = null;

  goBack = () => {
    window.close();
  };

  render() {
    const {count, redirectUrl} = this.state;

    return (
      <div>
        <p>
          You are being redirected to {redirectUrl} in {count} seconds. Changed your mind?{' '}
          <a href="#" onClick={this.goBack}>
            Go back
          </a>
        </p>
      </div>
    );
  }
}

export default RedirectPage;
