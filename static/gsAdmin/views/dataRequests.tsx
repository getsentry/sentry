import {Component, Fragment} from 'react';

import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import {Link} from 'sentry/components/core/link';
import EmptyMessage from 'sentry/components/emptyMessage';
import EmailField from 'sentry/components/forms/fields/emailField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import withApi from 'sentry/utils/withApi';

import PageHeader from 'admin/components/pageHeader';

type Props = RouteComponentProps<unknown, unknown> & {
  api: Client;
};

type ResultQuery = {
  email: string;
  orgSlug: string;
};

type State = {
  email: string;
  loadingResults: boolean;
  orgSlug: string;
  results: null | any[];
  search: string;
  resultsQuery?: ResultQuery;
};

class DataRequests extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    const {query} = this.props.router.location;

    this.state = {
      orgSlug: query.orgSlug || '',
      email: query.email || '',
      loadingResults: query.orgSlug || query.email,
      results: null,
      search: this.props.router.location.search,
    };
  }

  componentDidMount() {
    if (this.state.loadingResults) {
      this.loadResults();
    }
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.search !== this.props.router.location.search) {
      this.loadResults();
    }
  }

  onSubmit = () => {
    this.props.router.push({
      pathname: this.props.router.location.pathname,
      query: {
        orgSlug: this.state.orgSlug,
        email: this.state.email,
      },
    });
  };

  loadResults = () => {
    this.setState({
      loadingResults: true,
      search: this.props.router.location.search,
    });

    if (this.state.orgSlug) {
      // if we're searching on behalf of a customer, we need to actually
      // search on their events
      this.props.api
        .requestPromise(`/organizations/${this.state.orgSlug}/events/`, {
          method: 'GET',
          query: {
            query: 'user.email:' + this.state.email,
          },
        })
        .then(results => {
          this.setState({
            resultsQuery: {
              orgSlug: this.state.orgSlug,
              email: this.state.email,
            },
            results: results.map((r: any) => ({
              type: 'event',
              data: r,
            })),
            loadingResults: false,
          });
        });

      return;
    }

    // otherwise we just need to verify if we have this user email address
    // in our user storage
    this.props.api
      .requestPromise('/users/', {
        method: 'GET',
        query: {
          query: 'email:' + this.state.email,
        },
      })
      .then(results => {
        this.setState({
          resultsQuery: {
            orgSlug: this.state.orgSlug,
            email: this.state.email,
          },
          results: results.map((r: any) => ({
            type: 'user',
            data: r,
          })),
          loadingResults: false,
        });
      });
  };

  renderLoading() {
    return <LoadingIndicator>Searching...</LoadingIndicator>;
  }

  renderResults() {
    const {results, resultsQuery} = this.state;

    if (!results) {
      return null;
    }

    if (results.length === 0) {
      return (
        <EmptyMessage title="No Results">
          There are no results within Sentry data matching this email address.
        </EmptyMessage>
      );
    }

    return (
      <Fragment>
        <h2>Results</h2>
        <p>{results.length} match found</p>
        <ul>
          {results.map(result => {
            switch (result.type) {
              case 'user':
                // eslint-disable-next-line no-case-declarations
                const user = result.data;
                return (
                  <li key={`user-${user.id}`}>
                    <Link to={`/_admin/users/${user.id}/`}>
                      {user.name} &lt;{user.email}&gt;
                    </Link>
                  </li>
                );
              case 'event':
                // eslint-disable-next-line no-case-declarations
                const event = result.data;
                return (
                  <li key={`event-${event.id}`}>
                    <ExternalLink
                      href={`/organizations/${resultsQuery?.orgSlug}/issues/${event.groupID}/`}
                    >
                      {event.id} - {event.title.substring(0, 128)}
                    </ExternalLink>
                  </li>
                );
              default:
                throw new Error('Unknown result type');
            }
          })}
        </ul>
      </Fragment>
    );
  }

  render() {
    const {orgSlug, email, loadingResults} = this.state;

    return (
      <Fragment>
        <PageHeader title="Data Requests" />

        <Alert.Container>
          <Alert type="warning" showIcon={false}>
            Use this form to determine what action needs taken for a data request.
          </Alert>
        </Alert.Container>

        <Panel>
          <PanelHeader>Data lookup</PanelHeader>

          <Form onSubmit={this.onSubmit} submitLabel="Continue">
            <TextField
              name="orgSlug"
              label="Organization Slug"
              value={orgSlug}
              onChange={(value: any) => this.setState({orgSlug: value})}
              help="If a specificcustomer submitted a request (on behalf of one of their users), enter the organization slug."
              placeholder="orgSlug"
            />
            <EmailField
              name="email"
              label="Email Address"
              required
              value={email}
              onChange={(value: any) => this.setState({email: value})}
              help="Enter the email address which the request is acting upon."
              placeholder="user@email.com"
            />
          </Form>
        </Panel>

        {loadingResults ? this.renderLoading() : this.renderResults()}
      </Fragment>
    );
  }
}

export default withApi(DataRequests);
