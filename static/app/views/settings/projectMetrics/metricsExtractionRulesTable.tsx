import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
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
import type {MetricsExtractionRule} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {MetricsExtractionRuleEditModal} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleEditModal';
import {
  useDeleteMetricsExtractionRules,
  useMetricsExtractionRules,
} from 'sentry/views/settings/projectMetrics/utils/api';
import {useSearchQueryParam} from 'sentry/views/settings/projectMetrics/utils/useSearchQueryParam';

type Props = {
  project: Project;
};

export function MetricsExtractionRulesTable({project}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
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
      navigate(`/settings/projects/${project.slug}/metrics/${rule.spanAttribute}/edit/`);
    },
    [project.slug, navigate]
  );

  useEffect(() => {
    const editPath = `/settings/projects/${project.slug}/metrics/${params.spanAttribute}/edit/`;

    if (location.pathname !== editPath) {
      return;
    }

    const rule = filteredExtractionRules.find(
      r => r.spanAttribute === params.spanAttribute
    );

    if (!rule) {
      return;
    }

    openModal(
      props => (
        <MetricsExtractionRuleEditModal
          project={project}
          metricExtractionRule={rule}
          {...props}
        />
      ),
      {
        modalCss,
        onClose: () => navigate(`/settings/projects/${project.slug}/metrics/`),
      }
    );
  }, [
    filteredExtractionRules,
    project,
    location.pathname,
    params.spanAttribute,
    navigate,
  ]);

  return (
    <Fragment>
      <SearchWrapper>
        <h6>{t('Span-based Metrics')}</h6>
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
          {t('Add Metric')}
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
        <Cell right key="filters">
          {t('Filters')}
        </Cell>,
        <Cell right key="actions">
          {t('Actions')}
        </Cell>,
      ]}
      emptyMessage={
        hasSearch
          ? t('No metrics match the query.')
          : t('You have not created any span-based metrics yet.')
      }
      isEmpty={extractionRules.length === 0}
      isLoading={isLoading}
    >
      {extractionRules
        .toSorted((a, b) => a?.spanAttribute?.localeCompare(b?.spanAttribute))
        .map(rule => (
          <Fragment key={rule.spanAttribute + rule.unit}>
            <Cell>{rule.spanAttribute}</Cell>
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
              <Button
                aria-label={t('Delete metric')}
                size="xs"
                icon={<IconDelete />}
                borderless
                onClick={() => onDelete(rule)}
              />
              <Button
                aria-label={t('Edit metric')}
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
  grid-template-columns: 1fr repeat(2, min-content);
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
