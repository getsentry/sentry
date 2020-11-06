import React from 'react';
import DocumentTitle from 'react-document-title';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import {t} from 'app/locale';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {BorderlessEventEntries} from 'app/components/events/eventEntries';
import Footer from 'app/components/footer';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import NotFound from 'app/components/errors/notFound';
import space from 'app/styles/space';
import {Group} from 'app/types';
import Link from 'app/components/links/link';

import SharedGroupHeader from './sharedGroupHeader';

type Props = RouteComponentProps<{shareId: string}, {}> & {
  api: Client;
};

type State = {
  group: Group | null;
  loading: boolean;
  error: boolean;
};

class SharedGroupDetails extends React.Component<Props, State> {
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

    if (group) {
      return group.title;
    }

    return 'Sentry';
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

    const {location} = this.props;
    const {permalink, latestEvent, project} = group;
    const title = this.getTitle();

    return (
      <DocumentTitle title={title}>
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
              <div className="content">
                <SharedGroupHeader group={group} />
                <Container className="group-overview event-details-container">
                  <BorderlessEventEntries
                    location={location}
                    organization={project.organization}
                    group={group}
                    event={latestEvent}
                    project={project}
                    isShare
                  />
                </Container>
                <Footer />
              </div>
            </div>
          </div>
        </div>
      </DocumentTitle>
    );
  }
}

const Container = styled('div')`
  padding: 0 ${space(4)};
`;

export {SharedGroupDetails};
export default withApi(SharedGroupDetails);
