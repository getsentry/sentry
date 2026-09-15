import {useState} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {UserAvatar} from '@sentry/scraps/avatar';
import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import type {OrganizationSummary} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

import {AdminSearchCombobox} from 'admin/components/adminSearchCombobox';
import {allCellsQueryOptions, fetchFromAllCells} from 'admin/utils/allCells';
import {Overview} from 'admin/views/overview';

type OrganizationSearchResult = Pick<OrganizationSummary, 'id' | 'name' | 'slug'>;

type ProjectSearchResult = Pick<Project, 'id' | 'slug'> & {
  organization: Pick<OrganizationSummary, 'slug'>;
};

function normalizeProjectIdQuery(query: string): string | null {
  const match = query.match(/^(?:id:)?\s*(\d+)$/);
  return match?.[1] ?? null;
}

function renderOrganizationResult(organization: OrganizationSearchResult) {
  return (
    <Text as="span">
      <Text as="span" bold>
        {organization.slug}
      </Text>{' '}
      (
      <Text as="span" variant="muted">
        {organization.name}
      </Text>
      )
    </Text>
  );
}

function renderUserResult(user: User) {
  const displayName = user.name || user.username || user.email;
  const identifiers = [...new Set([user.email, user.username])].filter(
    identifier => identifier && identifier !== displayName
  );

  return (
    <Flex align="center" gap="md" minWidth={0}>
      <UserAvatar user={user} size={32} />
      <Stack gap="2xs" flex={1} minWidth={0}>
        <Grid align="center" columns="minmax(0, 1fr) auto" gap="sm">
          <Text as="span" bold ellipsis>
            {displayName}
          </Text>
          <Flex align="center" gap="xs">
            {user.isSuperuser ? (
              <Badge variant="internal">Superuser</Badge>
            ) : user.isStaff ? (
              <Badge variant="muted">Staff</Badge>
            ) : null}
            {user.isSuspended ? (
              <Badge variant="danger">Suspended</Badge>
            ) : user.isActive ? null : (
              <Badge variant="warning">Inactive</Badge>
            )}
          </Flex>
        </Grid>
        <Text as="span" size="sm" variant="muted" ellipsis>
          {[...identifiers, `ID ${user.id}`].join(' · ')}
        </Text>
      </Stack>
    </Flex>
  );
}

function renderProjectResult(project: ProjectSearchResult) {
  return (
    <Text as="span">
      <Text as="span" bold>
        {project.organization.slug}
      </Text>
      : {project.slug} (id:{' '}
      <Text as="span" variant="muted">
        {project.id}
      </Text>
      )
    </Text>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [oldSplash, setOldSplash] = useState(false);

  const orgSelect = (organization: OrganizationSearchResult) => {
    navigate(`/_admin/customers/${organization.slug}/`);
  };
  const orgSubmit = (query: string) => {
    navigate({
      pathname: '/_admin/customers/',
      query: {
        query,
      },
    });
  };
  const userSelect = (user: User) => {
    navigate(`/_admin/users/${user.id}/`);
  };
  const userSubmit = (query: string) => {
    navigate({
      pathname: '/_admin/users/',
      query: {
        query,
      },
    });
  };
  const projSelect = (project: ProjectSearchResult) => {
    navigate(`/_admin/customers/${project.organization.slug}/projects/${project.slug}/`);
  };
  const invoiceLookup = useMutation({
    mutationFn: async (invoiceId: string) => {
      const outcomes = await fetchFromAllCells(queryClient, cell => [
        getApiUrl('/_admin/cells/$region/admin-invoices/$invoiceId/', {
          path: {region: cell.name, invoiceId},
        }),
        {host: cell.locality_url},
      ]);
      const found = outcomes.find(outcome => outcome.status === 'fulfilled');
      if (!found) {
        throw new Error('No invoice with this ID exists in any region');
      }
      return found.cell;
    },
    onSuccess: (cell, invoiceId) => {
      navigate(`/_admin/invoices/${cell.name}/${invoiceId}/`);
    },
  });
  const invoiceSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const invoiceId = formData.get('invoiceId');

    if (typeof invoiceId === 'string' && invoiceId.trim()) {
      invoiceLookup.mutate(invoiceId.trim());
    }
  };

  if (oldSplash) {
    return <Overview />;
  }
  return (
    <Container padding="2xl">
      <Stack gap="lg" margin="3xl 0 2xl 0">
        <Heading as="h1" size="2xl">
          Welcome to the Admin Portal!
        </Heading>
        <Stack gap="xs">
          <Text>
            This is an internal tool meant to enable Sentry Employees (you!) to better
            assist and resolve issues that may arise for our customers.
          </Text>
          <Text variant="muted">
            If you have any questions, ask us in{' '}
            <ExternalLink href="https://app.slack.com/client/T024ZCV9U/CQDHVRS2W">
              #triage-product
            </ExternalLink>
            .
          </Text>
        </Stack>
        <Alert variant="danger">
          <Text bold>All actions are logged and audited.</Text>
        </Alert>
      </Stack>
      <Container paddingTop="xl">
        <AdminSearchCombobox
          label="Users"
          placeholder="Query users"
          getResultKey={user => user.id}
          getResultSearchTerms={user => [user.username, user.email, user.name]}
          onSelectResult={userSelect}
          onSearch={userSubmit}
          queryOptions={query =>
            apiOptions.as<User[]>()('/users/', {
              query: {query, per_page: 10},
              staleTime: 30_000,
            })
          }
          renderResult={renderUserResult}
        />
      </Container>
      <Container padding="3xl 0">
        <Container paddingTop="xl">
          <AdminSearchCombobox
            label="Organizations"
            placeholder="Query organizations"
            getResultKey={organization => organization.id}
            getResultSearchTerms={organization => [organization.slug, organization.name]}
            isExactMatch={(organization, query) =>
              organization.slug.toLowerCase() === query.toLowerCase()
            }
            onSelectResult={orgSelect}
            onSearch={orgSubmit}
            queryOptions={query =>
              allCellsQueryOptions<OrganizationSearchResult>(cell => [
                getApiUrl('/_admin/cells/$region/customers/', {
                  path: {region: cell.name},
                }),
                {
                  host: cell.locality_url,
                  query: {query, per_page: 50, sortBy: 'members'},
                },
              ])
            }
            renderResult={renderOrganizationResult}
          />
        </Container>

        <Container paddingTop="xl">
          <AdminSearchCombobox
            label="Projects (by ID)"
            placeholder="Project ID"
            getResultKey={project => project.id}
            getResultSearchTerms={project => [
              project.id,
              project.slug,
              project.organization.slug,
            ]}
            onSelectResult={projSelect}
            queryOptions={query => {
              const projectId = normalizeProjectIdQuery(query);
              return {
                ...allCellsQueryOptions<ProjectSearchResult>(cell => [
                  getApiUrl('/projects/'),
                  {
                    host: cell.locality_url,
                    query: {query: `id:${projectId}`, per_page: 10, show: 'all'},
                  },
                ]),
                enabled: projectId !== null,
              };
            }}
            renderResult={renderProjectResult}
          />
        </Container>

        <Container paddingTop="xl">
          <form onSubmit={invoiceSubmit}>
            <Stack gap="xs">
              <Text as="label" bold htmlFor="invoiceId">
                Invoices
              </Text>
              <Flex gap="sm">
                <Input
                  id="invoiceId"
                  name="invoiceId"
                  placeholder="Invoice GUID"
                  required
                />
                <Button type="submit" disabled={invoiceLookup.isPending}>
                  Open invoice
                </Button>
              </Flex>
              {invoiceLookup.isError && (
                <Text as="div" role="alert" size="sm" variant="danger">
                  {invoiceLookup.error.message}
                </Text>
              )}
            </Stack>
          </form>
        </Container>
      </Container>

      <Flex align="center" gap="md" margin="xl 0">
        <Text variant="muted">Looking for the old overview page?</Text>
        <Button size="xs" onClick={() => setOldSplash(true)}>
          Click here
        </Button>
      </Flex>
    </Container>
  );
}
