import React from 'react';
import styled from '@emotion/styled';

import rawStacktraceContent from 'app/components/events/interfaces/rawStacktraceContent';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import ClippedBox from 'app/components/clippedBox';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import Button from 'app/components/button';
import {t} from 'app/locale';
import {Event, Project, Organization, PlatformType, ExceptionType} from 'app/types';
import {Client} from 'app/api';

type Props = {
  projectId: Project['id'];
  api: Client;
  type: 'original' | 'minified';
  platform: PlatformType;
  eventId: Event['id'];
  // XXX: Organization is NOT available for Shared Issues!
  organization: Organization;
} & Pick<ExceptionType, 'values'>;

type State = {
  loading: boolean;
  error: boolean;
  crashReport: string;
};

class RawExceptionContent extends React.Component<Props, State> {
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
    const {type, projectId, eventId} = this.props;

    const minified = type === 'minified';
    return `/projects/${organization.slug}/${projectId}/events/${eventId}/apple-crash-report?minified=${minified}`;
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
              size="xsmall"
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
    const {values} = this.props;
    const isNative = this.isNative();

    if (!values) {
      return null;
    }

    return (
      <React.Fragment>
        {values.map((exc, excIdx) => {
          const {downloadButton, content} = this.getContent(isNative, exc);
          if (!downloadButton && !content) {
            return null;
          }
          return (
            <div key={excIdx}>
              {downloadButton}
              <pre className="traceback plain">{content}</pre>
            </div>
          );
        })}
      </React.Fragment>
    );
  }
}

export default withApi(withOrganization(RawExceptionContent));

const DownloadBtnWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;
