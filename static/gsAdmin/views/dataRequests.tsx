import {Fragment} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryStates} from 'nuqs';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {EmptyState} from '@sentry/scraps/emptyState';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {PageHeader} from 'admin/components/pageHeader';

type EventResult = {
  groupID: string;
  id: string;
  title: string;
};

type Result = {data: EventResult; type: 'event'} | {data: User; type: 'user'};

const schema = z.object({
  orgSlug: z.string().trim(),
  email: z.email('Enter a valid email address'),
});

export function DataRequests() {
  const [{orgSlug, email}, setSearchParams] = useQueryStates({
    orgSlug: parseAsString.withDefault(''),
    email: parseAsString.withDefault(''),
  });
  const hasQuery = Boolean(orgSlug || email);
  const isEventSearch = Boolean(orgSlug);

  const {data: eventsData = [], isLoading: isLoadingEvents} = useQuery(
    apiOptions.as<EventResult[]>()('/organizations/$organizationIdOrSlug/events/', {
      path: hasQuery && isEventSearch ? {organizationIdOrSlug: orgSlug} : skipToken,
      query: {query: 'user.email:' + email},
      staleTime: 0,
    })
  );

  const {data: usersData = [], isLoading: isLoadingUsers} = useQuery({
    ...apiOptions.as<User[]>()('/users/', {
      query: {query: 'email:' + email},
      staleTime: 0,
    }),
    enabled: hasQuery && !isEventSearch,
  });

  const isLoading = isLoadingEvents || isLoadingUsers;

  const results: Result[] | null = hasQuery
    ? isEventSearch
      ? eventsData.map(data => ({type: 'event', data}))
      : usersData.map(data => ({type: 'user', data}))
    : null;

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {orgSlug, email},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      setSearchParams(schema.parse(value), {history: 'push'});
    },
  });

  const renderResults = () => {
    if (!results) {
      return null;
    }

    if (results.length === 0) {
      return (
        <EmptyState
          title="No Results"
          description="There are no results within Sentry data matching this email address."
        />
      );
    }

    return (
      <Stack gap="md">
        <Heading as="h2">Results</Heading>
        <Text as="p">
          {results.length} {results.length === 1 ? 'match' : 'matches'} found
        </Text>
        <Stack as="ul" gap="sm" padding="0" style={{listStyle: 'none'}}>
          {results.map(result => {
            switch (result.type) {
              case 'user':
                // eslint-disable-next-line no-case-declarations
                const user = result.data;
                return (
                  <Stack
                    as="li"
                    key={`user-${user.id}`}
                    gap="2xs"
                    padding="md"
                    border="primary"
                    radius="md"
                    background="primary"
                  >
                    <Link to={`/_admin/users/${user.id}/`}>{user.name}</Link>
                    <Text size="sm" variant="muted">
                      {user.email}
                    </Text>
                  </Stack>
                );
              case 'event':
                // eslint-disable-next-line no-case-declarations
                const event = result.data;
                return (
                  <Stack
                    as="li"
                    key={`event-${event.id}`}
                    gap="2xs"
                    padding="md"
                    border="primary"
                    radius="md"
                    background="primary"
                  >
                    <ExternalLink
                      href={`/organizations/${orgSlug}/issues/${event.groupID}/`}
                    >
                      {event.id} - {event.title.substring(0, 128)}
                    </ExternalLink>
                    <Text size="sm" variant="muted">
                      Event
                    </Text>
                  </Stack>
                );
              default:
                throw new Error('Unknown result type');
            }
          })}
        </Stack>
      </Stack>
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

      <form.AppForm form={form}>
        <Panel>
          <Flex
            align="center"
            padding="xl"
            borderBottom="primary"
            background="secondary"
            radius="md md 0 0"
          >
            <Text size="sm" bold uppercase density="compressed">
              Data lookup
            </Text>
          </Flex>
          <Container padding="xl">
            <Stack gap="xl">
              <form.AppField name="orgSlug">
                {field => (
                  <field.Layout.Stack
                    label="Organization Slug"
                    hintText="If a specific customer submitted a request (on behalf of one of their users), enter the organization slug."
                  >
                    <field.Input
                      value={field.state.value}
                      onChange={field.handleChange}
                      placeholder="orgSlug"
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
              <form.AppField name="email">
                {field => (
                  <field.Layout.Stack
                    label="Email Address"
                    hintText="Enter the email address which the request is acting upon."
                    required
                  >
                    <field.Input
                      type="email"
                      value={field.state.value}
                      onChange={field.handleChange}
                      placeholder="user@email.com"
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            </Stack>
          </Container>
          <Flex justify="end" padding="xl" borderTop="primary">
            <form.SubmitButton>Search</form.SubmitButton>
          </Flex>
        </Panel>
      </form.AppForm>

      {isLoading ? <LoadingIndicator>Searching...</LoadingIndicator> : renderResults()}
    </Fragment>
  );
}
