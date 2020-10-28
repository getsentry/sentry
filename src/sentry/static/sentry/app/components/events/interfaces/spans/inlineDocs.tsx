import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {loadDocs} from 'app/actionCreators/projects';
import {t, tct} from 'app/locale';
import LoadingIndicator from 'app/components/loadingIndicator';
import {PlatformKey} from 'app/data/platformCategories';

type Props = {
  api: Client;

  platform: string;
  projectSlug: string;
  orgSlug: string;
};

type State = {
  loading: boolean;
  html: string | undefined;
  link: string | undefined;
};

class InlineDocs extends React.Component<Props, State> {
  state: State = {
    loading: true,
    html: undefined,
    link: undefined,
  };

  componentDidMount() {
    this.fetchData();
  }

  fetchData = async () => {
    const {platform, api, orgSlug, projectSlug} = this.props;

    if (!platform) {
      return;
    }

    this.setState({loading: true});

    let tracingPlatform: PlatformKey;
    switch (platform) {
      case 'sentry.python': {
        tracingPlatform = 'python-tracing';
        break;
      }
      case 'sentry.javascript.node': {
        tracingPlatform = 'node-tracing';
        break;
      }
      default: {
        this.setState({loading: false});
        return;
      }
    }

    try {
      const {html, link} = await loadDocs(api, orgSlug, projectSlug, tracingPlatform);
      this.setState({html, link});
    } catch (error) {
      Sentry.captureException(error);
      this.setState({html: undefined, link: undefined});
    }

    this.setState({loading: false});
  };

  render() {
    const {platform} = this.props;

    if (!platform) {
      return null;
    }

    if (this.state.loading) {
      return (
        <div>
          <LoadingIndicator />
        </div>
      );
    }

    if (this.state.html) {
      return (
        <div>
          <h4>{t('Requires Manual Instrumentation')}</h4>
          <DocumentationWrapper dangerouslySetInnerHTML={{__html: this.state.html}} />
          <p>
            {tct(
              `For in-depth instructions on setting up tracing, view [docLink:our documentation].`,
              {
                docLink: <a href={this.state.link} />,
              }
            )}
          </p>
        </div>
      );
    }

    return (
      <div>
        <h4>{t('Requires Manual Instrumentation')}</h4>
        <p>
          {tct(
            `To manually instrument certain regions of your code, view [docLink:our documentation].`,
            {
              docLink: <a href="https://docs.sentry.io/performance-monitoring/setup/" />,
            }
          )}
        </p>
      </div>
    );
  }
}

const DocumentationWrapper = styled('div')`
  p {
    line-height: 1.5;
  }
  pre {
    word-break: break-all;
    white-space: pre-wrap;
  }
`;

export default withApi(InlineDocs);
