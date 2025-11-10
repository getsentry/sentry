import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ExternalLink} from 'sentry/components/core/link';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import {t, tct} from 'sentry/locale';
import type {DebugFile} from 'sentry/types/debugFiles';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import ProjectProguardRow from './projectProguardRow';

export type ProguardMappingAssociation = {
  releases: string[];
};

export default function ProjectProguard() {
  const api = useApi();
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const {
    data: mappings,
    isPending: dataLoading,
    getResponseHeader,
    refetch: fetchData,
  } = useApiQuery<DebugFile[]>(
    [
      `/projects/${organization.slug}/${project.slug}/files/dsyms/`,
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
          `/projects/${
            organization.slug
          }/${project.slug}/files/dsyms/?id=${encodeURIComponent(id)}`,
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
        {mappings?.length
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
      </StyledPanelTable>
      <Pagination pageLinks={mappingsPageLinks} />
    </Fragment>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: minmax(220px, 1fr) max-content 120px;
`;

const SizeColumn = styled('div')`
  text-align: right;
`;
