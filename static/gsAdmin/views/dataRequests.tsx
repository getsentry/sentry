import {Fragment, useMemo, useState} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {ExternalLink, Link} from 'sentry/components/core/link';
import EmptyMessage from 'sentry/components/emptyMessage';
import EmailField from 'sentry/components/forms/fields/emailField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import PageHeader from 'admin/components/pageHeader';

type ResultQuery = {
  email: string;
  orgSlug: string;
};

function DataRequests() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialOrgSlug = (location.query.orgSlug as string | undefined) || '';
  const initialEmail = (location.query.email as string | undefined) || '';

  const [orgSlug, setOrgSlug] = useState<string>(initialOrgSlug);
  const [email, setEmail] = useState<string>(initialEmail);
  const queryFromRouterOrgSlug = (location.query.orgSlug as string | undefined) || '';
  const queryFromRouterEmail = (location.query.email as string | undefined) || '';
  const hasQuery = Boolean(queryFromRouterOrgSlug || queryFromRouterEmail);
  const isEventSearch = Boolean(queryFromRouterOrgSlug);

  const resultsQuery = useMemo<ResultQuery | undefined>(() => {
    if (!hasQuery) {
      return undefined;
    }
    return {orgSlug: queryFromRouterOrgSlug, email: queryFromRouterEmail};
  }, [hasQuery, queryFromRouterOrgSlug, queryFromRouterEmail]);

  const {data: eventsData = [], isLoading: isLoadingEvents} = useApiQuery<any[]>(
    [
      `/organizations/${queryFromRouterOrgSlug}/events/`,
      {query: {query: 'user.email:' + queryFromRouterEmail}},
    ],
    {
      staleTime: 0,
      enabled: hasQuery && isEventSearch,
    }
  );

  const {data: usersData = [], isLoading: isLoadingUsers} = useApiQuery<any[]>(
    ['/users/', {query: {query: 'email:' + queryFromRouterEmail}}],
    {
      staleTime: 0,
      enabled: hasQuery && !isEventSearch,
    }
  );

  const isLoading = isLoadingEvents || isLoadingUsers;

  const results = hasQuery
    ? (isEventSearch ? eventsData : usersData).map(r => ({
        type: isEventSearch ? 'event' : 'user',
        data: r,
      }))
    : null;

  const onSubmit = () => {
    navigate({
      pathname: location.pathname,
      query: {
        orgSlug,
        email,
      },
    });
  };

  const renderLoading = () => {
    return <LoadingIndicator>Searching...</LoadingIndicator>;
  };

  const renderResults = () => {
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
  };

  return (
    <Fragment>
      <PageHeader title="Data Requests" />

      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          Use this form to determine what action needs taken for a data request.
        </Alert>
      </Alert.Container>

      <Panel>
        <PanelHeader>Data lookup</PanelHeader>

        <Form onSubmit={onSubmit} submitLabel="Continue">
          <TextField
            name="orgSlug"
            label="Organization Slug"
            value={orgSlug}
            defaultValue={initialOrgSlug}
            onChange={(value: string) => setOrgSlug(value)}
            help="If a specificcustomer submitted a request (on behalf of one of their users), enter the organization slug."
            placeholder="orgSlug"
          />
          <EmailField
            name="email"
            label="Email Address"
            required
            value={email}
            defaultValue={initialEmail}
            onChange={(value: string) => setEmail(value)}
            help="Enter the email address which the request is acting upon."
            placeholder="user@email.com"
          />
        </Form>
      </Panel>

      {isLoading ? renderLoading() : renderResults()}
    </Fragment>
  );
}

export default DataRequests;
