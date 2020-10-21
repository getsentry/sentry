import PropTypes from 'prop-types';
import DocumentTitle from 'react-document-title';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import {BorderlessEventEntries} from 'app/components/events/eventEntries';
import Footer from 'app/components/footer';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import NotFound from 'app/components/errors/notFound';
import SentryTypes from 'app/sentryTypes';
import SharedGroupHeader from 'app/views/sharedGroupDetails/sharedGroupHeader';
import space from 'app/styles/space';

const SharedGroupDetails = createReactClass({
  displayName: 'SharedGroupDetails',

  propTypes: {
    api: PropTypes.object,
  },

  childContextTypes: {
    group: SentryTypes.Group,
  },

  getInitialState() {
    return {
      group: null,
      loading: true,
      error: false,
    };
  },

  getChildContext() {
    return {
      group: this.state.group,
    };
  },

  componentWillMount() {
    this.fetchData();
    document.body.classList.add('shared-group');
  },

  componentWillUnmount() {
    document.body.classList.remove('shared-group');
  },

  getTitle() {
    if (this.state.group) {
      return this.state.group.title;
    }
    return 'Sentry';
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    this.props.api.request(this.getGroupDetailsEndpoint(), {
      success: data => {
        this.setState({
          loading: false,
          group: data,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  getGroupDetailsEndpoint() {
    const id = this.props.params.shareId;

    return '/shared/issues/' + id + '/';
  },

  render() {
    const group = this.state.group;

    if (this.state.loading) {
      return <LoadingIndicator />;
    }

    if (!group) {
      return <NotFound />;
    }

    if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    const evt = this.state.group.latestEvent;

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          <div className="pattern-bg" />
          <div className="container">
            <div className="box box-modal">
              <div className="box-header">
                <a className="logo" href="/">
                  <span className="icon-sentry-logo-full" />
                </a>
                {this.state.group.permalink && (
                  <a className="details" href={this.state.group.permalink}>
                    {t('Details')}
                  </a>
                )}
              </div>
              <div className="content">
                <SharedGroupHeader group={group} />
                <Container className="group-overview event-details-container">
                  <BorderlessEventEntries
                    organization={group.project.organization}
                    group={group}
                    event={evt}
                    project={group.project}
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
  },
});

const Container = styled('div')`
  padding: 0 ${space(4)};
`;

export {SharedGroupDetails};

export default withApi(SharedGroupDetails);
