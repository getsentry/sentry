import {Component, Fragment} from 'react';

import type {Client} from 'sentry/api';
import {
  getAppleCrashReportEndpoint,
  getContent,
} from 'sentry/components/events/interfaces/crashContent/exception/utils';
import type {Event, ExceptionType} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey, Project} from 'sentry/types/project';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  api: Client;
  eventId: Event['id'];
  projectSlug: Project['slug'];
  type: 'original' | 'minified';
  // XXX: Organization is NOT available for Shared Issues!
  organization?: Organization;
  platform?: PlatformKey;
} & Pick<ExceptionType, 'values'>;

type State = {
  crashReport: string;
  error: boolean;
  loading: boolean;
};

class RawContent extends Component<Props, State> {
  state: State = {
    loading: false,
    error: false,
    crashReport: '',
  };

  componentDidMount() {
    if (this.isNative()) {
      this.fetchAppleCrashReport();
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.isNative() && this.props.type !== prevProps.type) {
      this.fetchAppleCrashReport();
    }
  }

  isNative() {
    const {platform} = this.props;
    return (
      platform === 'cocoa' || platform === 'native' || platform === 'nintendo-switch'
    );
  }

  async fetchAppleCrashReport() {
    const {api, organization, type, projectSlug, eventId} = this.props;

    // Shared issues do not have access to organization
    if (!organization) {
      return;
    }

    this.setState({
      loading: true,
      error: false,
      crashReport: '',
    });

    try {
      const data = await api.requestPromise(
        getAppleCrashReportEndpoint(organization, type, projectSlug, eventId),
        {headers: {Accept: '*/*; charset=utf-8'}}
      );
      this.setState({
        error: false,
        loading: false,
        crashReport: data,
      });
    } catch {
      this.setState({error: true, loading: false});
    }
  }

  render() {
    const {values, projectSlug, eventId, api, platform, organization, type} = this.props;
    const {loading, error, crashReport} = this.state;
    const isNative = this.isNative();

    if (!values) {
      return null;
    }

    return (
      <Fragment>
        {values.map((exc, excIdx) => {
          const {downloadButton, content} = getContent(
            isNative,
            exc,
            type,
            projectSlug,
            eventId,
            api,
            platform,
            loading,
            error,
            crashReport,
            organization
          );

          if (!downloadButton && !content) {
            return null;
          }
          return (
            <div key={excIdx} data-test-id="raw-stack-trace">
              <pre className="traceback plain">{content}</pre>
            </div>
          );
        })}
      </Fragment>
    );
  }
}

export default withApi(withOrganization(RawContent));
