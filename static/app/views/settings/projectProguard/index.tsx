import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import ExternalLink from 'sentry/components/links/externalLink';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import {t, tct} from 'sentry/locale';
import type {DebugFile} from 'sentry/types/debugFiles';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {DebugIdBundleAssociation} from 'sentry/types/sourceMaps';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery, useQueries} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import ProjectProguardRow from './projectProguardRow';

export type ProjectProguardProps = RouteComponentProps<{projectId: string}> & {
  organization: Organization;
  project: Project;
};

export type ProguardMappingAssociation = {
  releases: string[];
};

export type AssociatedMapping = {
  mapping?: DebugFile;
  releaseAssociation?: DebugIdBundleAssociation[];
};

function ProjectProguard({organization, location, router, params}: ProjectProguardProps) {
  const api = useApi();
  const {projectId} = params;
  const [loading, setLoading] = useState(false);

  const {
    data: mappings,
    isPending: dataLoading,
    getResponseHeader,
    refetch: fetchData,
  } = useApiQuery<DebugFile[]>(
    [
      `/projects/${organization.slug}/${projectId}/files/dsyms/`,
      {
        query: {
          query: location.query.query,
          file_formats: 'proguard',
          cursor: location.query.cursor,
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  const mappingsPageLinks = getResponseHeader?.('Link');

  const associationsResults = useQueries({
    queries:
      mappings?.map(mapping => {
        const queryKey = [
          `/projects/${organization.slug}/${projectId}/files/proguard-artifact-releases/`,
          {
            query: {
              proguard_uuid: mapping.uuid,
            },
          },
        ] as ApiQueryKey;
        return {
          queryKey,
          queryFn: () =>
            api.requestPromise(queryKey[0], {
              method: 'GET',
              query: queryKey[1]?.query,
            }) as Promise<ProguardMappingAssociation>,
        };
      }) ?? [],
  });

  const associationsFetched = associationsResults.every(result => result.isFetched);

  const handleSearch = useCallback(
    (query: string) => {
      router.push({
        ...location,
        query: {...location.query, cursor: undefined, query: query || undefined},
      });
    },
    [location, router]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        await api.requestPromise(
          `/projects/${
            organization.slug
          }/${projectId}/files/dsyms/?id=${encodeURIComponent(id)}`,
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
    [api, fetchData, organization.slug, projectId]
  );

  const query =
    typeof location.query.query === 'string' ? location.query.query : undefined;

  const isLoading = loading || dataLoading || !associationsFetched;

  return (
    <Fragment>
      <SettingsPageHeader
        title={t('ProGuard Mappings')}
        action={
          <SearchBar
            placeholder={t('Filter mappings')}
            onSearch={handleSearch}
            query={query}
            width="280px"
          />
        }
      />

      <TextBlock>
        {tct(
          `ProGuard mapping files are used to convert minified classes, methods and field names into a human readable format. To learn more about proguard mapping files, [link: read the docs].`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/android/proguard/" />
            ),
          }
        )}
      </TextBlock>

      <StyledPanelTable
        headers={[t('Mapping'), <SizeColumn key="size">{t('File Size')}</SizeColumn>, '']}
        emptyMessage={
          query
            ? t('There are no mappings that match your search.')
            : t('There are no mappings for this project.')
        }
        isEmpty={mappings?.length === 0}
        isLoading={isLoading}
      >
        {!mappings?.length
          ? null
          : mappings.map((mapping, index) => {
              const downloadUrl = `${api.baseUrl}/projects/${
                organization.slug
              }/${projectId}/files/dsyms/?id=${encodeURIComponent(mapping.id)}`;

              return (
                <ProjectProguardRow
                  mapping={mapping}
                  associations={associationsResults[index]!.data}
                  downloadUrl={downloadUrl}
                  onDelete={handleDelete}
                  key={mapping.id}
                  orgSlug={organization.slug}
                />
              );
            })}
      </StyledPanelTable>
      <Pagination pageLinks={mappingsPageLinks} />
    </Fragment>
  );
}

export default ProjectProguard;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: minmax(220px, 1fr) max-content 120px;
`;

const SizeColumn = styled('div')`
  text-align: right;
`;
