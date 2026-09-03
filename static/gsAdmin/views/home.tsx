import {useState} from 'react';
import {skipToken} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {UserAvatar} from '@sentry/scraps/avatar';
import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import type {OrganizationSummary} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getCells} from 'sentry/utils/cells';
import {useNavigate} from 'sentry/utils/useNavigate';

import {AdminSearchCombobox} from 'admin/components/adminSearchCombobox';
import {Overview} from 'admin/views/overview';

type OrganizationSearchResult = Pick<OrganizationSummary, 'id' | 'name' | 'slug'>;

type ProjectSearchResult = Pick<Project, 'id' | 'slug'> & {
  organization: Pick<OrganizationSummary, 'slug'>;
};

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
  const cells = getCells();
  const [oldSplash, setOldSplash] = useState(false);
  const [localityUrl, setLocalityUrl] = useState(cells[0]!.locality_url);
  const selectedCell = cells.find(cell => cell.locality_url === localityUrl);

  const orgSelect = (organization: OrganizationSearchResult) => {
    navigate(`/_admin/customers/${organization.slug}/`);
  };
  const orgSubmit = (query: string) => {
    navigate({
      pathname: '/_admin/customers/',
      query: {
        query,
        regionUrl: localityUrl,
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
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix="Region" />
          )}
          value={localityUrl}
          options={cells.map(c => ({
            label: c.name,
            value: c.locality_url,
          }))}
          onChange={opt => {
            setLocalityUrl(opt.value);
          }}
        />

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
              apiOptions.as<OrganizationSearchResult[]>()(
                '/_admin/cells/$region/customers/',
                {
                  path: selectedCell ? {region: selectedCell.name} : skipToken,
                  query: {query, per_page: 50, sortBy: 'members'},
                  host: localityUrl,
                  staleTime: 30_000,
                }
              )
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
            queryOptions={query =>
              apiOptions.as<ProjectSearchResult[]>()('/projects/', {
                query: {query: `id:${query}`, per_page: 10, show: 'all'},
                host: localityUrl,
                staleTime: 30_000,
              })
            }
            renderResult={renderProjectResult}
          />
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
