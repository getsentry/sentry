import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import ClippedBox from 'sentry/components/clippedBox';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {ExceptionType, Organization, PlatformType, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import rawStacktraceContent from '../stackTrace/rawContent';

type Props = {
  api: Client;
  eventId: Event['id'];
  platform: PlatformType;
  projectSlug: Project['slug'];
  type: 'original' | 'minified';
  // XXX: Organization is NOT available for Shared Issues!
  organization?: Organization;
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
    return platform === 'cocoa' || platform === 'native';
  }

  getAppleCrashReportEndpoint(organization: Organization) {
    const {type, projectSlug, eventId} = this.props;

    const minified = type === 'minified';
    return `/projects/${organization.slug}/${projectSlug}/events/${eventId}/apple-crash-report?minified=${minified}`;
  }

  getContent(isNative: boolean, exc: any) {
    const {type} = this.props;

    const output = {
      downloadButton: null,
      content: exc.stacktrace
        ? rawStacktraceContent(
            type === 'original' ? exc.stacktrace : exc.rawStacktrace,
            this.props.platform,
            exc
          )
        : null,
    };

    if (!isNative) {
      return output;
    }

    const {loading, error, crashReport} = this.state;

    if (loading) {
      return {
        ...output,
        content: <LoadingIndicator />,
      };
    }

    if (error) {
      return {
        ...output,
        content: <LoadingError />,
      };
    }

    if (!loading && !!crashReport) {
      const {api, organization} = this.props;
      let downloadButton: React.ReactElement | null = null;

      if (organization) {
        const appleCrashReportEndpoint = this.getAppleCrashReportEndpoint(organization);

        downloadButton = (
          <DownloadBtnWrapper>
            <Button
              size="xs"
              href={`${api.baseUrl}${appleCrashReportEndpoint}&download=1`}
            >
              {t('Download')}
            </Button>
          </DownloadBtnWrapper>
        );
      }

      return {
        downloadButton,
        content: <ClippedBox clipHeight={250}>{crashReport}</ClippedBox>,
      };
    }

    return output;
  }

  async fetchAppleCrashReport() {
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

    try {
      const data = await api.requestPromise(
        this.getAppleCrashReportEndpoint(organization)
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
    const {values, organization} = this.props;
    const isNative = this.isNative();

    if (!values) {
      return null;
    }

    const hasNativeStackTraceV2 = !!organization?.features?.includes(
      'native-stack-trace-v2'
    );

    return (
      <Fragment>
        {values.map((exc, excIdx) => {
          const {downloadButton, content} = this.getContent(isNative, exc);
          if (!downloadButton && !content) {
            return null;
          }
          return (
            <div key={excIdx} data-test-id="raw-stack-trace">
              {!hasNativeStackTraceV2 ? downloadButton : null}
              <pre className="traceback plain">{content}</pre>
            </div>
          );
        })}
      </Fragment>
    );
  }
}

export default withApi(withOrganization(RawContent));

const DownloadBtnWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;
