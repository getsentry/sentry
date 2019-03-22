import PropTypes from 'prop-types';
import React from 'react';
import rawStacktraceContent from 'app/components/events/interfaces/rawStacktraceContent';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import ClippedBox from 'app/components/clippedBox';

import withApi from 'app/utils/withApi';

class RawExceptionContent extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    type: PropTypes.oneOf(['original', 'minified']),
    platform: PropTypes.string,
    eventId: PropTypes.string,
    values: PropTypes.array.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      error: false,
      crashReport: '',
    };
  }

  componentDidMount() {
    if (this.isNative()) {
      this.fetchAppleCrashReport();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.isNative() && this.props.type !== prevProps.type) {
      this.fetchAppleCrashReport();
    }
  }

  isNative() {
    const {platform} = this.props;
    return platform === 'cocoa' || platform === 'native';
  }

  getAppleCrashReportEndpoint() {
    const minified = this.props.type == 'minified';
    return `/events/${this.props.eventId}/apple-crash-report?minified=${minified}`;
  }

  fetchAppleCrashReport() {
    this.setState({
      loading: true,
      error: false,
      crashReport: '',
    });
    this.props.api.request(this.getAppleCrashReportEndpoint(), {
      method: 'GET',
      success: data => {
        this.setState({
          error: false,
          loading: false,
          crashReport: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  }

  render() {
    const {type} = this.props;
    let downloadButton;
    const children = this.props.values.map((exc, excIdx) => {
      let content =
        exc.stacktrace &&
        rawStacktraceContent(
          type === 'original' ? exc.stacktrace : exc.rawStacktrace,
          this.props.platform,
          exc
        );
      if (this.isNative()) {
        if (this.state.loading) {
          content = <LoadingIndicator />;
        } else if (this.state.error) {
          content = <LoadingError onRetry={this.fetchData} />;
        } else if (!this.state.loading && this.state.crashReport != '') {
          content = <ClippedBox clipHeight={250}>{this.state.crashReport}</ClippedBox>;
          downloadButton = (
            <a
              href={
                this.props.api.baseUrl +
                this.getAppleCrashReportEndpoint() +
                '&download=1'
              }
              className="btn btn-default btn-sm pull-right"
            >
              Download
            </a>
          );
        }
      }

      return (
        <div key={excIdx}>
          {downloadButton}
          <pre className="traceback plain">{content}</pre>
        </div>
      );
    });

    return <div>{children}</div>;
  }
}

export default withApi(RawExceptionContent);
