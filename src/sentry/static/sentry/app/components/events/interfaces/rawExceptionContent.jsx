import React from 'react';
import rawStacktraceContent from './rawStacktraceContent';
import ApiMixin from '../../../mixins/apiMixin';
import LoadingIndicator from '../../loadingIndicator';
import LoadingError from '../../loadingError';
import ClippedBox from '../../clippedBox';

const RawExceptionContent = React.createClass({
  propTypes: {
    type: React.PropTypes.oneOf(['original', 'minified']),
    platform: React.PropTypes.string,
    eventId: React.PropTypes.string,
    values: React.PropTypes.array.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
      error: false,
      crashReport: ''
    };
  },

  componentDidMount() {
    if (this.props.platform == 'cocoa') {
      this.fetchAppleCrashReport();
    }
  },

  componentDidUpdate(prevProps) {
    if (this.props.platform == 'cocoa' && this.props.type !== prevProps.type) {
      this.fetchAppleCrashReport();
    }
  },

  getAppleCrashReportEndpoint() {
    let minified = this.props.type == 'minified';
    return `/events/${this.props.eventId}/apple-crash-report?minified=${minified}`;
  },

  fetchAppleCrashReport() {
    this.setState({
      loading: true,
      error: false,
      crashReport: ''
    });
    this.api.request(this.getAppleCrashReportEndpoint(), {
      method: 'GET',
      success: data => {
        this.setState({
          error: false,
          loading: false,
          crashReport: data
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
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
      if (this.props.platform == 'cocoa') {
        if (this.state.loading) content = <LoadingIndicator />;
        else if (this.state.error) content = <LoadingError onRetry={this.fetchData} />;
        else if (!this.state.loading && this.state.crashReport != '') {
          content = (
            <ClippedBox clipHeight={250}>
              {this.state.crashReport}
            </ClippedBox>
          );
          downloadButton = (
            <a
              href={this.api.baseUrl + this.getAppleCrashReportEndpoint() + '&download=1'}
              className="btn btn-default btn-sm pull-right">
              Download
            </a>
          );
        }
      }

      return (
        <div key={excIdx}>
          {downloadButton}
          <pre className="traceback plain">
            {content}
          </pre>
        </div>
      );
    });

    return (
      <div>
        {children}
      </div>
    );
  }
});

export default RawExceptionContent;
