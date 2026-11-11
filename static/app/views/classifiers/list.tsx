import styled from '@emotion/styled';
import {IconAdd} from '@sentry/icons/add';
import {skipToken, useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getPaginationProps} from 'sentry/utils/pagination';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {TopBar} from 'sentry/views/navigation/topBar';

import type {TelemetryClassifier} from './types';
import {
  getClassifierDetailPath,
  getDatasetLabel,
  getEnrichmentAttributeName,
  getNewClassifierPath,
} from './utils';

const CLASSIFIERS_PER_PAGE = 25;

const CLASSIFIER_COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(0, 1fr)'},
  {key: 'attribute', visible: {md: true}, width: '300px'},
  {key: 'data-type', visible: {sm: true}, width: '130px'},
];

function CreateClassifierMenu() {
  const organization = useOrganization();
  const pathname = getNewClassifierPath(organization.slug);

  return (
    <DropdownMenu
      position="bottom-end"
      minMenuWidth={260}
      items={[
        {
          key: 'conversation',
          label: tct('Classifier on [dataset:conversations]', {dataset: <strong />}),
          textValue: t('Classifier on conversations'),
          to: {pathname, query: {dataset: 'conversation'}},
        },
        {
          key: 'trace_spans',
          label: tct('Classifier on [dataset:spans]', {dataset: <strong />}),
          textValue: t('Classifier on spans'),
          to: {pathname, query: {dataset: 'trace_spans'}},
        },
      ]}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          showChevron={false}
          {...triggerProps}
          variant="primary"
          icon={<IconAdd />}
        >
          {t('Create New Classifier')}
        </OverlayTrigger.Button>
      )}
    />
  );
}

function ClassifierRow({classifier}: {classifier: TelemetryClassifier}) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: classifier.projectId});
  const isDisabled = classifier.status === 'disabled';

  return (
    <SimpleTable.Row variant={isDisabled ? 'faded' : 'default'}>
      <SimpleTable.RowCell>
        <Stack gap="2xs" minWidth="0">
          <Flex align="center" gap="sm" minWidth="0">
            <ClassifierLink
              to={getClassifierDetailPath(organization.slug, classifier.id)}
            >
              <Text variant="inherit" ellipsis>
                {classifier.name}
              </Text>
            </ClassifierLink>
            {isDisabled && <Tag variant="muted">{t('Disabled')}</Tag>}
          </Flex>
          {project && (
            <Flex align="center" gap="xs" minWidth="0">
              <ProjectAvatar project={project} size={16} />
              <Text size="xs" variant="muted" density="compressed" ellipsis>
                {project.slug}
              </Text>
            </Flex>
          )}
        </Stack>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Text
          monospace
          size="sm"
          density="compressed"
          ellipsis
          title={getEnrichmentAttributeName(classifier.resultAttribute)}
        >
          {getEnrichmentAttributeName(classifier.resultAttribute)}
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Tag variant="muted">{getDatasetLabel(classifier.dataset)}</Tag>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

function ClassifiersTable() {
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();
  const [cursor] = useQueryState('cursor', parseAsString);

  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<TelemetryClassifier[]>()(
      '/organizations/$organizationIdOrSlug/classifiers/',
      {
        path: isReady ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          project: selection.projects,
          cursor: cursor ?? undefined,
          per_page: CLASSIFIERS_PER_PAGE,
        },
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
  });

  const classifiers = data?.json ?? [];

  return (
    <div>
      <SimpleTable
        columns={CLASSIFIER_COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Classifier')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Attribute')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Data type')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isPending ? (
          <SimpleTable.Loading />
        ) : isError ? (
          <SimpleTable.Error
            message={t('Error loading classifiers')}
            onRetry={() => refetch()}
          />
        ) : classifiers.length === 0 ? (
          <SimpleTable.Empty>{t('No classifiers found.')}</SimpleTable.Empty>
        ) : (
          classifiers.map(classifier => (
            <ClassifierRow key={classifier.id} classifier={classifier} />
          ))
        )}
      </SimpleTable>
      <Pagination {...getPaginationProps(data?.headers.Link)} />
    </div>
  );
}

export default function ClassifiersList() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('Classifiers')} orgSlug={organization.slug}>
      <TopBar.Slot
        name="breadcrumbs"
        title={{type: 'page-title', label: t('Classifiers')}}
      />
      <PageFiltersContainer>
        <Stack gap="lg" padding="xl">
          <Flex justify="between" align="center" gap="lg">
            <PageFilterBar>
              <ProjectPageFilter resetParamsOnChange={['cursor']} />
            </PageFilterBar>
            <CreateClassifierMenu />
          </Flex>
          <ClassifiersTable />
        </Stack>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const ClassifierLink = styled(Link)`
  display: block;
  min-width: 0;
  color: ${p => p.theme.tokens.content.headings};

  &:hover {
    color: ${p => p.theme.tokens.content.headings};
    text-decoration: underline;
  }
`;
