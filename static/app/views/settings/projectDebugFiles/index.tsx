import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Grid} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SearchBar} from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {BuiltinSymbolSource, CustomRepo, DebugFile} from 'sentry/types/debugFiles';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {routeTitleGen} from 'sentry/utils/routeTitle';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {DebugFileRow} from './debugFileRow';
import {Sources} from './sources';

export default function ProjectDebugSymbols() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const location = useLocation();
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);

  const query = location.query.query as string | undefined;
  const cursor = location.query.cursor as string | undefined;

  const debugFilesApiOptions = apiOptions.as<DebugFile[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/files/dsyms/',
    {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query: {query, cursor},
      staleTime: 0,
    }
  );

  const {
    data: debugFilesResponse,
    isPending: isLoadingDebugFiles,
    isLoadingError: isLoadingErrorDebugFiles,
    refetch: refetchDebugFiles,
  } = useQuery({
    ...debugFilesApiOptions,
    select: selectJsonWithHeaders,
    retry: false,
  });

  const debugFiles = debugFilesResponse?.json;

  const symbolSourcesOptions = apiOptions.as<BuiltinSymbolSource[] | null>()(
    '/organizations/$organizationIdOrSlug/builtin-symbol-sources/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {platform: project.platform},
      staleTime: 0,
    }
  );

  const {
    data: builtinSymbolSources,
    isPending: isLoadingSymbolSources,
    isError: isErrorSymbolSources,
    refetch: refetchSymbolSources,
  } = useQuery({
    ...symbolSourcesOptions,
    retry: 0,
  });

  const handleSearch = useCallback(
    (value: string) => {
      navigate({
        ...location,
        query: {...location.query, cursor: undefined, query: value ? value : undefined},
      });
    },
    [navigate, location]
  );

  const {mutate: handleDeleteDebugFile} = useMutation<unknown, RequestError, string>({
    mutationFn: (id: string) => {
      return api.requestPromise(
        `${getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/files/dsyms/', {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: project.slug,
          },
        })}?id=${id}`,
        {
          method: 'DELETE',
        }
      );
    },
    onMutate: () => {
      addLoadingMessage('Deleting debug file');
    },
    onSuccess: () => {
      addSuccessMessage('Successfully deleted debug file');

      // invalidate debug files query
      queryClient.invalidateQueries({
        queryKey: debugFilesApiOptions.queryKey,
      });

      // invalidate symbol sources query
      queryClient.invalidateQueries({
        queryKey: symbolSourcesOptions.queryKey,
      });
    },
    onError: () => {
      addErrorMessage('Failed to delete debug file');
    },
  });

  return (
    <SentryDocumentTitle title={routeTitleGen(t('Debug Files'), project.slug, false)}>
      <SettingsPageHeader
        title={t('Debug Information Files')}
        subtitle={t(`
          Debug information files are used to convert addresses and minified
          function names from native crash reports into function names and
          locations.
        `)}
      />

      <ProjectPermissionAlert project={project} />

      {isLoadingSymbolSources ? (
        <LoadingIndicator />
      ) : isErrorSymbolSources ? (
        <LoadingError
          onRetry={refetchSymbolSources}
          message={t('There was an error loading repositories.')}
        />
      ) : (
        <Sources
          location={location}
          project={project}
          organization={organization}
          customRepositories={
            (project.symbolSources
              ? JSON.parse(project.symbolSources)
              : []) as CustomRepo[]
          }
          builtinSymbolSources={project.builtinSymbolSources ?? []}
          builtinSymbolSourceOptions={builtinSymbolSources ?? []}
        />
      )}

      {isLoadingDebugFiles ? (
        <LoadingIndicator />
      ) : isLoadingErrorDebugFiles ? (
        <LoadingError
          onRetry={refetchDebugFiles}
          message={t('There was an error loading debug information files.')}
        />
      ) : (
        <Fragment>
          <Grid
            columns={{zero: '1fr', xl: 'auto 1fr'}}
            gap={{zero: 'md', xl: '3xl'}}
            align="center"
            marginTop="3xl"
            marginBottom="md"
          >
            <TextBlock noMargin>{t('Uploaded debug information files')}</TextBlock>
            <Grid
              columns={{zero: 'min-content 1fr', xl: 'min-content minmax(200px, 400px)'}}
              align="center"
              justify="end"
              gap="xl"
            >
              <Label>
                <Checkbox
                  checked={showDetails}
                  onChange={e => {
                    setShowDetails(e.target.checked);
                  }}
                />
                {t('show details')}
              </Label>

              <SearchBar
                placeholder={t('Search DIFs')}
                onSearch={handleSearch}
                query={query}
              />
            </Grid>
          </Grid>

          <StyledSimpleTable
            header={
              <SimpleTable.HeaderRow>
                <SimpleTable.HeaderCell>{t('Debug ID')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Information')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>
                  <Actions>{t('Actions')}</Actions>
                </SimpleTable.HeaderCell>
              </SimpleTable.HeaderRow>
            }
          >
            {isLoadingDebugFiles && <SimpleTable.Loading />}
            {!isLoadingDebugFiles && debugFiles?.length === 0 && (
              <SimpleTable.Empty>
                {query
                  ? t('There are no debug symbols that match your search.')
                  : t('There are no debug symbols for this project.')}
              </SimpleTable.Empty>
            )}
            {debugFiles?.length
              ? debugFiles.map(debugFile => {
                  const downloadUrl = `${api.baseUrl}/projects/${organization.slug}/${project.slug}/files/dsyms/?id=${debugFile.id}`;

                  return (
                    <DebugFileRow
                      debugFile={debugFile}
                      showDetails={showDetails}
                      downloadUrl={downloadUrl}
                      onDelete={handleDeleteDebugFile}
                      key={debugFile.id}
                      orgSlug={organization.slug}
                      project={project}
                    />
                  );
                })
              : null}
          </StyledSimpleTable>
          <Pagination pageLinks={debugFilesResponse?.headers.Link} />
        </Fragment>
      )}
    </SentryDocumentTitle>
  );
}

const StyledSimpleTable = styled(SimpleTable)`
  grid-template-columns: 37% 1fr auto;
`;

const Actions = styled('div')`
  text-align: right;
`;

const Label = styled('label')`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  display: flex;
  align-items: center;
  margin-bottom: 0;
  white-space: nowrap;
  gap: ${p => p.theme.space.md};
`;
