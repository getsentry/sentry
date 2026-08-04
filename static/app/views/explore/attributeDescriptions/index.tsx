import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import type {CursorHandler} from '@sentry/scraps/pagination';
import {Pagination} from '@sentry/scraps/pagination';
import {Heading, Text} from '@sentry/scraps/text';

import {openModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {SearchBar} from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconArrow, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {decodeScalar} from 'sentry/utils/queryString';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  BRIEF_MAX_LENGTH,
  EditAttributeDescriptionModal,
} from 'sentry/views/explore/attributeDescriptions/editAttributeDescriptionModal';
import {
  type AttributeTypeValue,
  isAttributeTypeValue,
  isEditableAttribute,
  type TraceItemAttributeListItem,
  type TraceItemDatasetValue,
} from 'sentry/views/explore/attributeDescriptions/types';
import {useAttributeDescriptionsQueryOptions} from 'sentry/views/explore/attributeDescriptions/useAttributeDescriptions';
import {makeMetricsPathname} from 'sentry/views/explore/metrics/utils';
import {TopBar} from 'sentry/views/navigation/topBar';

const DATASET_OPTIONS: Array<{label: string; value: TraceItemDatasetValue}> = [
  {label: t('Spans'), value: 'spans'},
  {label: t('Logs'), value: 'logs'},
  {label: t('Trace Metrics'), value: 'tracemetrics'},
  {label: t('Preprod'), value: 'preprod'},
  {label: t('Processing Errors'), value: 'processing_errors'},
];

const DEFAULT_DATASET: TraceItemDatasetValue = 'spans';

const ATTRIBUTE_TYPE_OPTIONS: Array<{label: string; value: AttributeTypeValue | ''}> = [
  {label: t('All types'), value: ''},
  {label: t('String'), value: 'string'},
  {label: t('Number'), value: 'number'},
  {label: t('Boolean'), value: 'boolean'},
];

const PAGE_TITLE = t('Attribute Descriptions');

export default function AttributeDescriptionsContent() {
  const organization = useOrganization();
  const maxPickableDays = useMaxPickableDays({dataCategories: [DataCategory.SPANS]});
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <Feature
      features={['data-browsing-attribute-context']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <SentryDocumentTitle title={PAGE_TITLE} orgSlug={organization.slug}>
        <PageFiltersContainer>
          <TopBar.Slot name="title">{PAGE_TITLE}</TopBar.Slot>
          <AttributeDescriptionsBody datePageFilterProps={datePageFilterProps} />
        </PageFiltersContainer>
      </SentryDocumentTitle>
    </Feature>
  );
}

interface AttributeDescriptionsBodyProps {
  datePageFilterProps: ReturnType<typeof useDatePageFilterProps>;
}

function AttributeDescriptionsBody({
  datePageFilterProps,
}: AttributeDescriptionsBodyProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const datasetParam = decodeScalar(location.query.dataset, '');
  const dataset = DATASET_OPTIONS.some(option => option.value === datasetParam)
    ? (datasetParam as TraceItemDatasetValue)
    : DEFAULT_DATASET;
  const search = decodeScalar(location.query.query, '');
  const typeParam = decodeScalar(location.query.attributeType, '');
  const attributeType = isAttributeTypeValue(typeParam) ? typeParam : undefined;
  const cursor = decodeScalar(location.query.cursor);

  const {
    data,
    isPending,
    isError,
    refetch: refetchQuery,
  } = useQuery({
    ...useAttributeDescriptionsQueryOptions({dataset, attributeType, search, cursor}),
    select: selectJsonWithHeaders,
  });

  const attributes = data?.json ?? [];
  const pageLinks = data?.headers?.Link ?? null;

  // Filter and search changes reset pagination to the first page.
  const updateQuery = (updates: Record<string, string | undefined>) => {
    navigate({
      pathname: location.pathname,
      query: {...location.query, cursor: undefined, ...updates},
    });
  };

  const handleCursor: CursorHandler = (nextCursor, path, query) => {
    navigate({pathname: path, query: {...query, cursor: nextCursor}});
  };

  const openEditModal = (attribute: TraceItemAttributeListItem) => {
    openModal(deps => (
      <EditAttributeDescriptionModal
        {...deps}
        attribute={attribute}
        dataset={dataset}
        onSuccess={refetchQuery}
      />
    ));
  };

  const openViewModal = (attribute: TraceItemAttributeListItem) => {
    openModal(({Header, Body}) => (
      <Fragment>
        <Header closeButton>
          <Heading as="h4">{attribute.key}</Heading>
        </Header>
        <Body>
          <Stack gap="xl">
            {attribute.context?.brief ? (
              <Stack gap="xs">
                <Text size="sm" bold variant="muted">
                  {t('Brief')}
                </Text>
                <Text>{attribute.context.brief}</Text>
              </Stack>
            ) : null}
            {attribute.context?.details?.length ? (
              <Stack gap="xs">
                <Text size="sm" bold variant="muted">
                  {t('Additional context')}
                </Text>
                {attribute.context.details.map((detail, i) => (
                  <Text key={i}>{detail}</Text>
                ))}
              </Stack>
            ) : null}
            {attribute.context?.examples?.length ? (
              <Stack gap="xs">
                <Text size="sm" bold variant="muted">
                  {t('Examples')}
                </Text>
                {attribute.context.examples.map((example, i) => (
                  <Text key={i} monospace>
                    {example}
                  </Text>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Body>
      </Fragment>
    ));
  };

  return (
    <BodyContainer>
      <Flex gap="md" wrap="wrap">
        <LinkButton
          icon={<IconArrow direction="left" />}
          size="sm"
          to={makeMetricsPathname({organizationSlug: organization.slug, path: '/'})}
        >
          {t('Back to metrics')}
        </LinkButton>
        <LinkButton
          size="sm"
          to={makeMetricsPathname({
            organizationSlug: organization.slug,
            path: '/descriptions/',
          })}
        >
          {t('Metric descriptions')}
        </LinkButton>
      </Flex>

      <FilterBar>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter {...datePageFilterProps} />
        <CompactSelect
          value={dataset}
          options={DATASET_OPTIONS}
          onChange={option => updateQuery({dataset: option.value, cursor: undefined})}
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix={t('Dataset')} />
          )}
        />
        <CompactSelect
          value={attributeType ?? ''}
          options={ATTRIBUTE_TYPE_OPTIONS}
          onChange={option => updateQuery({attributeType: option.value || undefined})}
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix={t('Type')} />
          )}
        />
        <SearchWrapper>
          <SearchBar
            defaultQuery={search}
            placeholder={t('Search by attribute name')}
            onSearch={value => updateQuery({query: value || undefined})}
          />
        </SearchWrapper>
      </FilterBar>

      <StyledSimpleTable data-test-id="attribute-descriptions-table">
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Attribute')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Type')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Source')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Brief')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Additional context')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell />
        </SimpleTable.Header>

        {isError ? (
          <SimpleTable.Empty>{t('Unable to load attributes.')}</SimpleTable.Empty>
        ) : isPending ? (
          <SimpleTable.Empty>{t('Loading…')}</SimpleTable.Empty>
        ) : attributes.length === 0 ? (
          <SimpleTable.Empty>{t('No attributes found.')}</SimpleTable.Empty>
        ) : (
          attributes.map(attribute => {
            const detailsText = attribute.context?.details?.join(' ') ?? '';
            const isDetailsTruncated = detailsText.length > BRIEF_MAX_LENGTH;
            const editable = isEditableAttribute(attribute);
            return (
              <SimpleTable.Row key={`${attribute.key}:${attribute.attributeType}`}>
                <SimpleTable.RowCell>
                  <Text bold monospace>
                    {attribute.key}
                  </Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Text>{attribute.attributeType}</Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Text variant="muted">
                    {attribute.context?.isConvention
                      ? t('convention')
                      : attribute.context?.isCustom
                        ? t('custom')
                        : attribute.attributeSource.source_type}
                  </Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  {attribute.context?.brief ? (
                    <Text>{attribute.context.brief}</Text>
                  ) : (
                    <Text variant="muted">{t('No description')}</Text>
                  )}
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  {detailsText ? (
                    <Flex gap="sm" align="center">
                      <Text>
                        {isDetailsTruncated
                          ? `${detailsText.slice(0, BRIEF_MAX_LENGTH)}…`
                          : detailsText}
                      </Text>
                      {isDetailsTruncated ? (
                        <Button
                          size="xs"
                          variant="link"
                          onClick={() => openViewModal(attribute)}
                        >
                          {t('View full')}
                        </Button>
                      ) : null}
                    </Flex>
                  ) : (
                    <Text variant="muted">{'—'}</Text>
                  )}
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  {editable ? (
                    <Button
                      size="xs"
                      icon={<IconEdit />}
                      aria-label={t('Edit description for %s', attribute.key)}
                      onClick={() => openEditModal(attribute)}
                    >
                      {t('Edit')}
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant="link"
                      onClick={() => openViewModal(attribute)}
                    >
                      {t('View')}
                    </Button>
                  )}
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            );
          })
        )}
      </StyledSimpleTable>

      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </BodyContainer>
  );
}

const BodyContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space['2xl']};
`;

const FilterBar = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${p => p.theme.space.md};
  align-items: center;
`;

const SearchWrapper = styled('div')`
  flex: 1;
  min-width: 240px;
`;

const StyledSimpleTable = styled(SimpleTable)`
  grid-template-columns:
    minmax(160px, 1.2fr) max-content max-content minmax(160px, 1.5fr)
    minmax(160px, 1.5fr) max-content;
`;
