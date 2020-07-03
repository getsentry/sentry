import PropTypes from 'prop-types';
import React from 'react';

import rawStacktraceContent from 'app/components/events/interfaces/rawStacktraceContent';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import ClippedBox from 'app/components/clippedBox';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import {t} from 'app/locale';

class RawExceptionContent extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    type: PropTypes.oneOf(['original', 'minified']),
    platform: PropTypes.string,
    eventId: PropTypes.string,
    projectId: PropTypes.string.isRequired,
    values: PropTypes.array.isRequired,

    // XXX: Organization is NOT available for Shared Issues!
    organization: SentryTypes.Organization,
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
    const {type, organization, projectId, eventId} = this.props;

    const minified = type === 'minified';
    return `/projects/${organization.slug}/${projectId}/events/${eventId}/apple-crash-report?minified=${minified}`;
  }

  fetchAppleCrashReport() {
    const {api, organization} = this.props;

    // Shared issues do not have access to organization
    if (!organization) {
      return;
    }

    this.setState({
      loading: true,
      error: false,
      crashReport: '',
    });

    api.request(this.getAppleCrashReportEndpoint(), {
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
        } else if (!this.state.loading && this.state.crashReport !== '') {
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
              {t('Download')}
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

export default withApi(withOrganization(RawExceptionContent));
