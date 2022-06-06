import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import NotFound from 'sentry/components/errors/notFound';
import {BorderlessEventEntries} from 'sentry/components/events/eventEntries';
import Footer from 'sentry/components/footer';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import SentryTypes from 'sentry/sentryTypes';
import space from 'sentry/styles/space';
import {Group} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

import SharedGroupHeader from './sharedGroupHeader';

type Props = RouteComponentProps<{shareId: string}, {}> & {
  api: Client;
};

type State = {
  error: boolean;
  group: Group | null;
  loading: boolean;
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

  getTitle() {
    const {group} = this.state;

    return group?.title ?? 'Sentry';
  }

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
    const {permalink, latestEvent, project} = group;
    const title = this.getTitle();

    return (
      <SentryDocumentTitle noSuffix title={title}>
        <div className="app">
          <div className="pattern-bg" />
          <div className="container">
            <div className="box box-modal">
              <div className="box-header">
                <Link className="logo" to="/">
                  <span className="icon-sentry-logo-full" />
                </Link>
                {permalink && (
                  <Link className="details" to={permalink}>
                    {t('Details')}
                  </Link>
                )}
              </div>
              <div className="box-content">
                <SharedGroupHeader group={group} />
                <Container className="group-overview event-details-container">
                  <BorderlessEventEntries
                    location={location}
                    organization={project.organization}
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
              </div>
            </div>
          </div>
        </div>
      </SentryDocumentTitle>
    );
  }
}

const Container = styled('div')`
  padding: ${space(4)};
`;

export {SharedGroupDetails};
export default withApi(SharedGroupDetails);
