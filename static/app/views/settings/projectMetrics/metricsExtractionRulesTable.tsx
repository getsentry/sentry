import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Tag from 'sentry/components/badge/tag';
import {Button, LinkButton} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import {modalCss} from 'sentry/components/featureFeedback/feedbackModal';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconEdit} from 'sentry/icons/iconEdit';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import useOrganization from 'sentry/utils/useOrganization';
import {MetricsExtractionRuleEditModal} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleEditModal';
import {
  type MetricsExtractionRule,
  useDeleteMetricsExtractionRules,
  useMetricsExtractionRules,
} from 'sentry/views/settings/projectMetrics/utils/api';
import {useSearchQueryParam} from 'sentry/views/settings/projectMetrics/utils/useSearchQueryParam';

type Props = {
  project: Project;
};

export function MetricsExtractionRulesTable({project}: Props) {
  const organization = useOrganization();
  const [query, setQuery] = useSearchQueryParam('query');

  const {data: extractionRules, isLoading} = useMetricsExtractionRules(
    organization.slug,
    project.slug
  );
  const {mutate: deleteMetricsExtractionRules} = useDeleteMetricsExtractionRules(
    organization.slug,
    project.slug
  );

  const filteredExtractionRules = useMemo(() => {
    return (extractionRules || []).filter(rule =>
      rule.spanAttribute.toLowerCase().includes(query.toLowerCase())
    );
  }, [extractionRules, query]);

  const handleDelete = useCallback(
    (rule: MetricsExtractionRule) => {
      openConfirmModal({
        onConfirm: () =>
          deleteMetricsExtractionRules(
            {metricsExtractionRules: [rule]},
            {
              onSuccess: () => {
                addSuccessMessage(t('Metric extraction rule deleted'));
              },
              onError: () => {
                addErrorMessage(t('Failed to delete metric extraction rule'));
              },
            }
          ),
        message: t('Are you sure you want to delete this extraction rule?'),
        confirmText: t('Delete Extraction Rule'),
      });
    },
    [deleteMetricsExtractionRules]
  );

  const handleEdit = useCallback(
    (rule: MetricsExtractionRule) => {
      openModal(
        props => (
          <MetricsExtractionRuleEditModal
            project={project}
            metricExtractionRule={rule}
            {...props}
          />
        ),
        {modalCss}
      );
    },
    [project]
  );

  return (
    <Fragment>
      <SearchWrapper>
        <h6>{t('Metric Extraction Rules')}</h6>
        <FlexSpacer />
        <SearchBar
          placeholder={t('Search Metrics')}
          onChange={setQuery}
          query={query}
          size="sm"
        />
        <LinkButton
          to={`/settings/projects/${project.slug}/metrics/extract-metric`}
          priority="primary"
          size="sm"
        >
          {t('Add Extraction Rule')}
        </LinkButton>
      </SearchWrapper>
      <RulesTable
        isLoading={isLoading}
        onDelete={handleDelete}
        onEdit={handleEdit}
        extractionRules={filteredExtractionRules}
        hasSearch={!!query}
      />
    </Fragment>
  );
}

interface RulesTableProps {
  extractionRules: MetricsExtractionRule[];
  hasSearch: boolean;
  isLoading: boolean;
  onDelete: (rule: MetricsExtractionRule) => void;
  onEdit: (rule: MetricsExtractionRule) => void;
}

function RulesTable({
  extractionRules,
  isLoading,
  onDelete,
  onEdit,
  hasSearch,
}: RulesTableProps) {
  return (
    <ExtractionRulesPanelTable
      headers={[
        <Cell key="spanAttribute">
          <IconArrow size="xs" direction="down" />
          {t('Span attribute')}
        </Cell>,
        <Cell right key="type">
          {t('Type')}
        </Cell>,
        <Cell right key="unit">
          {t('Unit')}
        </Cell>,
        <Cell right key="filters">
          {t('Filters')}
        </Cell>,
        <Cell right key="tags">
          {t('Tags')}
        </Cell>,
        <Cell right key="actions">
          {t('Actions')}
        </Cell>,
      ]}
      emptyMessage={
        hasSearch
          ? t('No extraction rules match the query.')
          : t('You have not created any extraction rules yet.')
      }
      isEmpty={extractionRules.length === 0}
      isLoading={isLoading}
    >
      {extractionRules
        .toSorted((a, b) => a?.spanAttribute?.localeCompare(b?.spanAttribute))
        .map(rule => (
          <Fragment key={rule.spanAttribute + rule.type + rule.unit}>
            <Cell>{rule.spanAttribute}</Cell>
            <Cell right>
              <Tag>{getReadableMetricType(rule.type)}</Tag>
            </Cell>
            <Cell right>
              <Tag>{rule.unit}</Tag>
            </Cell>
            <Cell right>
              {rule.conditions.length ? (
                <Button priority="link" onClick={() => onEdit(rule)}>
                  {rule.conditions.length}
                </Button>
              ) : (
                <NoValue>{t('(none)')}</NoValue>
              )}
            </Cell>
            <Cell right>
              {rule.tags.length ? (
                <Button priority="link" onClick={() => onEdit(rule)}>
                  {rule.tags.length}
                </Button>
              ) : (
                <NoValue>{t('(none)')}</NoValue>
              )}
            </Cell>
            <Cell right>
              <Button
                aria-label={t('Delete rule')}
                size="xs"
                icon={<IconDelete />}
                borderless
                onClick={() => onDelete(rule)}
              />
              <Button
                aria-label={t('Edit rule')}
                size="xs"
                icon={<IconEdit />}
                borderless
                onClick={() => onEdit(rule)}
              />
            </Cell>
          </Fragment>
        ))}
    </ExtractionRulesPanelTable>
  );
}

const SearchWrapper = styled('div')`
  display: flex;
  align-items: flex-start;
  margin-top: ${space(4)};
  margin-bottom: ${space(1)};
  gap: ${space(1)};

  & > h6 {
    margin: 0;
  }
`;

const FlexSpacer = styled('div')`
  flex: 1;
`;

const ExtractionRulesPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr repeat(5, min-content);
`;

const Cell = styled('div')<{right?: boolean}>`
  display: flex;
  align-items: center;
  align-self: stretch;
  gap: ${space(0.5)};
  justify-content: ${p => (p.right ? 'flex-end' : 'flex-start')};
`;

const NoValue = styled('span')`
  color: ${p => p.theme.subText};
`;
