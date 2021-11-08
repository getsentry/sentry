import {Component} from 'react';
import DocumentTitle from 'react-document-title';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import NotFound from 'app/components/errors/notFound';
import {BorderlessEventEntries} from 'app/components/events/eventEntries';
import Footer from 'app/components/footer';
import Link from 'app/components/links/link';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import LogoSentry from 'app/components/logoSentry';
import {Panel, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {Group, SharedViewOrganization} from 'app/types';
import withApi from 'app/utils/withApi';

import SharedGroupHeader from './sharedGroupHeader';

type Props = RouteComponentProps<{shareId: string}, {}> & {
  api: Client;
};

type State = {
  group: Group | null;
  loading: boolean;
  error: boolean;
};

class SharedGroupDetails extends Component<Props, State> {
  static childContextTypes = {
    group: SentryTypes.Group,
  };

  state: State = this.getInitialState();

  getInitialState() {
    return {
      group: null,
      loading: true,
      error: false,
    };
  }

  getChildContext() {
    return {
      group: this.state.group,
    };
  }

  componentWillMount() {
    document.body.classList.add('shared-group');
  }

  componentDidMount() {
    this.fetchData();
  }

  componentWillUnmount() {
    document.body.classList.remove('shared-group');
  }

  async fetchData() {
    const {params, api} = this.props;
    const {shareId} = params;
    try {
      const group = await api.requestPromise(`/shared/issues/${shareId}/`);
      this.setState({loading: false, group});
    } catch {
      this.setState({loading: false, error: true});
    }
  }

  handleRetry = () => {
    this.setState(this.getInitialState());
    this.fetchData();
  };

  render() {
    const {group, loading, error} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (!group) {
      return <NotFound />;
    }

    if (error) {
      return <LoadingError onRetry={this.handleRetry} />;
    }

    const {location, api, route, router} = this.props;
    const {title, permalink, latestEvent, project} = group;

    // XXX(epurkhiser): Be careful. The organization represented here as part
    // of the shared group's project is NOT a full organization, just a slug
    // and name.
    const organization: SharedViewOrganization = project.organization;

    return (
      <DocumentTitle title={title ?? t('Sentry')}>
        <div className="app">
          <div className="pattern-bg" />
          <Wrapper>
            <Panel>
              <PanelHeader>
                <Link to="/">
                  <LogoSentry height="20" />
                </Link>
                {permalink && (
                  <Link className="details" to={permalink}>
                    {t('Details')}
                  </Link>
                )}
              </PanelHeader>
              <SharedGroupHeader group={group} />
              <Container className="group-overview event-details-container">
                <BorderlessEventEntries
                  location={location}
                  organization={organization}
                  group={group}
                  event={latestEvent}
                  project={project}
                  api={api}
                  route={route}
                  router={router}
                  isBorderless
                  isShare
                />
              </Container>
              <Footer />
            </Panel>
          </Wrapper>
        </div>
      </DocumentTitle>
    );
  }
}

const Container = styled('div')`
  padding: 0 ${space(4)};
`;

const Wrapper = styled('div')`
  max-width: 960px;
  margin: ${space(4)} auto;
`;

export default withApi(SharedGroupDetails);
