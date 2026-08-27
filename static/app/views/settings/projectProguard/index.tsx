import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {SearchBar} from 'sentry/components/searchBar';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import type {DebugFile} from 'sentry/types/debugFiles';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {ProjectProguardRow} from './projectProguardRow';

export default function ProjectProguard() {
  const api = useApi();
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const {
    data: mappingsResp,
    isPending: dataLoading,
    refetch: fetchData,
  } = useQuery({
    ...apiOptions.as<DebugFile[]>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/files/dsyms/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        query: {
          query: location.query.query,
          file_formats: 'proguard',
          cursor: location.query.cursor,
        },
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
  });
  const mappings = mappingsResp?.json;

  const mappingsPageLinks = mappingsResp?.headers.Link;

  const handleSearch = useCallback(
    (query: string) => {
      navigate({
        ...location,
        query: {...location.query, cursor: undefined, query: query || undefined},
      });
    },
    [location, navigate]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        await api.requestPromise(
          `${getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/files/dsyms/', {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.slug,
            },
          })}?id=${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
          }
        );
        setLoading(false);
        addSuccessMessage('Successfully deleted the mapping file');
        fetchData();
      } catch {
        setLoading(false);
        addErrorMessage('An error occurred while deleting the mapping file');
      }
    },
    [api, fetchData, organization.slug, project.slug]
  );

  const query =
    typeof location.query.query === 'string' ? location.query.query : undefined;

  const isLoading = loading || dataLoading;

  return (
    <Fragment>
      <SettingsPageHeader
        title={t('ProGuard Mappings')}
        subtitle={tct(
          'ProGuard mapping files are used to convert minified classes, methods and field names into a human readable format. To learn more about proguard mapping files, [link: read the docs].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/android/proguard/" />
            ),
          }
        )}
      />

      <Stack gap="md">
        <SearchBar
          placeholder={t('Filter mappings')}
          onSearch={handleSearch}
          query={query}
        />
        <StyledSimpleTable
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>{t('Mapping')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>
                <SizeColumn>{t('File Size')}</SizeColumn>
              </SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell />
            </SimpleTable.HeaderRow>
          }
        >
          {isLoading && <SimpleTable.Loading />}
          {!isLoading && mappings?.length === 0 && (
            <SimpleTable.Empty>
              {query
                ? t('There are no mappings that match your search.')
                : t('There are no mappings for this project.')}
            </SimpleTable.Empty>
          )}
          {!isLoading && mappings?.length
            ? mappings.map(mapping => {
                const downloadUrl = `${api.baseUrl}/projects/${
                  organization.slug
                }/${project.slug}/files/dsyms/?id=${encodeURIComponent(mapping.id)}`;

                return (
                  <ProjectProguardRow
                    mapping={mapping}
                    downloadUrl={downloadUrl}
                    onDelete={handleDelete}
                    key={mapping.id}
                    orgSlug={organization.slug}
                  />
                );
              })
            : null}
        </StyledSimpleTable>
        <Pagination pageLinks={mappingsPageLinks} />
      </Stack>
    </Fragment>
  );
}

const StyledSimpleTable = styled(SimpleTable)`
  grid-template-columns: minmax(220px, 1fr) max-content 120px;
`;

const SizeColumn = styled('div')`
  text-align: right;
`;
