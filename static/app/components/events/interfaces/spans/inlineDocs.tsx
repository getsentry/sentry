import {Component} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {loadDocs} from 'sentry/actionCreators/projects';
import {Client} from 'sentry/api';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  orgSlug: string;
  platform: string;
  projectSlug: string;
  resetCellMeasureCache: () => void;
};

type State = {
  html: string | undefined;
  link: string | undefined;
  loading: boolean;
};

class InlineDocs extends Component<Props, State> {
  state: State = {
    loading: true,
    html: undefined,
    link: undefined,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (this.state.loading === false && prevState.loading === true) {
      this.props.resetCellMeasureCache();
    }
  }

  fetchData = async () => {
    const {platform, api, orgSlug, projectSlug} = this.props;

    if (!platform) {
      return;
    }

    this.setState({loading: true});

    let tracingPlatform: 'python-tracing' | 'node-tracing' | 'react-native-tracing';

    if (platform.startsWith('sentry.python')) {
      tracingPlatform = 'python-tracing';
    } else if (platform.startsWith('sentry.javascript.node')) {
      tracingPlatform = 'node-tracing';
    } else if (platform.startsWith('sentry.javascript.react-native')) {
      tracingPlatform = 'react-native-tracing';
    } else {
      this.setState({loading: false});
      return;
    }

    try {
      const {html, link} = await loadDocs({
        api,
        orgSlug,
        projectSlug,
        platform: tracingPlatform,
      });
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
              docLink: (
                <ExternalLink href="https://docs.sentry.io/product/performance/getting-started/" />
              ),
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
`;

export default withApi(InlineDocs);
