import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import rawStacktraceContent from 'app/components/events/interfaces/rawStacktraceContent';
import ApiMixin from 'app/mixins/apiMixin';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import ClippedBox from 'app/components/clippedBox';

const RawExceptionContent = createReactClass({
  displayName: 'RawExceptionContent',

  propTypes: {
    type: PropTypes.oneOf(['original', 'minified']),
    platform: PropTypes.string,
    eventId: PropTypes.string,
    values: PropTypes.array.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
      error: false,
      crashReport: '',
    };
  },

  componentDidMount() {
    if (this.isNative()) {
      this.fetchAppleCrashReport();
    }
  },

  componentDidUpdate(prevProps) {
    if (this.isNative() && this.props.type !== prevProps.type) {
      this.fetchAppleCrashReport();
    }
  },

  isNative() {
    let {platform} = this.props;
    return platform === 'cocoa' || platform === 'native';
  },

  getAppleCrashReportEndpoint() {
    let minified = this.props.type == 'minified';
    return `/events/${this.props.eventId}/apple-crash-report?minified=${minified}`;
  },

  fetchAppleCrashReport() {
    this.setState({
      loading: true,
      error: false,
      crashReport: '',
    });
    this.api.request(this.getAppleCrashReportEndpoint(), {
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
  },

  render() {
    let {type} = this.props;
    let downloadButton;
    let children = this.props.values.map((exc, excIdx) => {
      let content =
        exc.stacktrace &&
        rawStacktraceContent(
          type === 'original' ? exc.stacktrace : exc.rawStacktrace,
          this.props.platform,
          exc
        );
      if (this.isNative()) {
        if (this.state.loading) content = <LoadingIndicator />;
        else if (this.state.error) content = <LoadingError onRetry={this.fetchData} />;
        else if (!this.state.loading && this.state.crashReport != '') {
          content = <ClippedBox clipHeight={250}>{this.state.crashReport}</ClippedBox>;
          downloadButton = (
            <a
              href={this.api.baseUrl + this.getAppleCrashReportEndpoint() + '&download=1'}
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
  },
});

export default RawExceptionContent;
