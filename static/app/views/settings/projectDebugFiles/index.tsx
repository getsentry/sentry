import {Fragment, useCallback, useMemo, useState} from 'react';
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Checkbox from 'sentry/components/checkbox';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {BuiltinSymbolSource, CustomRepo, DebugFile} from 'sentry/types/debugFiles';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import routeTitleGen from 'sentry/utils/routeTitle';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

import DebugFileRow from './debugFileRow';
import Sources from './sources';

type Props = RouteComponentProps<{projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

function ProjectDebugSymbols({organization, project, location, router, params}: Props) {
  const navigate = useNavigate();
  const api = useApi();

  const [showDetails, setShowDetails] = useState(false);

  const {
    data: debugFiles,
    getResponseHeader: getDebugFilesResponseHeader,
    isLoading: isLoadingDebugFiles,
    refetch: refetchDebugFiles,
  } = useApiQuery<DebugFile[] | null>(
    [
      `/projects/${organization.slug}/${params.projectId}/files/dsyms/`,
      {
        query: {query: location.query.query},
      },
    ],
    {
      staleTime: 0,
    }
  );

  const {
    data: builtinSymbolSources,
    isLoading: isLoadingSymbolSources,
    refetch: refetchBuiltinSymbolSources,
  } = useApiQuery<BuiltinSymbolSource[] | null>(
    [`/organizations/${organization.slug}/builtin-symbol-sources/`],
    {
      staleTime: 0,
      enabled: organization.features.includes('symbol-sources'),
    }
  );

  const handleSearch = useCallback(
    (query: string) => {
      navigate({
        ...location,
        query: {...location.query, cursor: undefined, query},
      });
    },
    [navigate, location]
  );

  const query = useMemo(() => {
    return typeof location.query === 'string' ? location.query : undefined;
  }, [location.query]);

  const {mutate: handleDeleteDebugFile} = useMutation<unknown, RequestError, string>({
    mutationFn: (id: string) => {
      return api.requestPromise(
        `/projects/${organization.slug}/${params.projectId}/files/dsyms/?id=${id}`,
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
      refetchDebugFiles();
      refetchBuiltinSymbolSources();
    },
    onError: () => {
      addErrorMessage('Failed to delete debug file');
    },
  });

  return (
    <SentryDocumentTitle title={routeTitleGen(t('Debug Files'), params.projectId, false)}>
      <SettingsPageHeader title={t('Debug Information Files')} />

      <TextBlock>
        {t(`
          Debug information files are used to convert addresses and minified
          function names from native crash reports into function names and
          locations.
        `)}
      </TextBlock>

      {organization.features.includes('symbol-sources') && (
        <Fragment>
          <PermissionAlert project={project} />

          <Sources
            api={api}
            location={location}
            router={router}
            project={project}
            organization={organization}
            customRepositories={
              (project.symbolSources
                ? JSON.parse(project.symbolSources)
                : []) as CustomRepo[]
            }
            builtinSymbolSources={project.builtinSymbolSources ?? []}
            builtinSymbolSourceOptions={builtinSymbolSources ?? []}
            isLoading={isLoadingSymbolSources}
          />
        </Fragment>
      )}

      <Wrapper>
        <TextBlock noMargin>{t('Uploaded debug information files')}</TextBlock>
        <Filters>
          <Label>
            <Checkbox
              checked={showDetails}
              onChange={e => {
                setShowDetails((e.target as HTMLInputElement).checked);
              }}
            />
            {t('show details')}
          </Label>

          <SearchBar
            placeholder={t('Search DIFs')}
            onSearch={handleSearch}
            query={query}
          />
        </Filters>
      </Wrapper>

      <StyledPanelTable
        headers={[
          t('Debug ID'),
          t('Information'),
          <Actions key="actions">{t('Actions')}</Actions>,
        ]}
        emptyMessage={
          query
            ? t('There are no debug symbols that match your search.')
            : t('There are no debug symbols for this project.')
        }
        isEmpty={debugFiles?.length === 0}
        isLoading={isLoadingDebugFiles}
      >
        {!debugFiles?.length
          ? null
          : debugFiles.map(debugFile => {
              const downloadUrl = `${api.baseUrl}/projects/${organization.slug}/${params.projectId}/files/dsyms/?id=${debugFile.id}`;

              return (
                <DebugFileRow
                  debugFile={debugFile}
                  showDetails={showDetails}
                  downloadUrl={downloadUrl}
                  downloadRole={organization.debugFilesRole}
                  onDelete={handleDeleteDebugFile}
                  key={debugFile.id}
                  orgSlug={organization.slug}
                  project={project}
                />
              );
            })}
      </StyledPanelTable>
      <Pagination pageLinks={getDebugFilesResponseHeader?.('Link')} />
    </SentryDocumentTitle>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 37% 1fr auto;
`;

const Actions = styled('div')`
  text-align: right;
`;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: ${space(4)};
  align-items: center;
  margin-top: ${space(4)};
  margin-bottom: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: block;
  }
`;

const Filters = styled('div')`
  display: grid;
  grid-template-columns: min-content minmax(200px, 400px);
  align-items: center;
  justify-content: flex-end;
  gap: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: min-content 1fr;
  }
`;

const Label = styled('label')`
  font-weight: ${p => p.theme.fontWeightNormal};
  display: flex;
  align-items: center;
  margin-bottom: 0;
  white-space: nowrap;
  gap: ${space(1)};
`;

export default ProjectDebugSymbols;
