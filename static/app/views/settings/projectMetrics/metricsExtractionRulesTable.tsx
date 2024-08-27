import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import {DateTime} from 'sentry/components/dateTime';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconEdit} from 'sentry/icons/iconEdit';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsExtractionRule} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCardinalityLimitedMetricVolume} from 'sentry/utils/metrics/useCardinalityLimitedMetricVolume';
import {useMembers} from 'sentry/utils/useMembers';
import useOrganization from 'sentry/utils/useOrganization';
import {openExtractionRuleCreateModal} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleCreateModal';
import {openExtractionRuleEditModal} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleEditModal';
import {
  useDeleteMetricsExtractionRules,
  useMetricsExtractionRules,
} from 'sentry/views/settings/projectMetrics/utils/useMetricsExtractionRules';
import {useSearchQueryParam} from 'sentry/views/settings/projectMetrics/utils/useSearchQueryParam';

type Props = {
  project: Project;
};

export function MetricsExtractionRulesTable({project}: Props) {
  const organization = useOrganization();
  const [query, setQuery] = useSearchQueryParam('query');

  const {data: extractionRules, isPending: isLoadingExtractionRules} =
    useMetricsExtractionRules({
      orgId: organization.slug,
      projectId: project.id,
      query: {query},
    });
  const {mutate: deleteMetricsExtractionRules} = useDeleteMetricsExtractionRules(
    organization.slug,
    project.id
  );
  const {data: cardinality, isPending: isLoadingCardinality} =
    useCardinalityLimitedMetricVolume({
      projects: [project.id],
    });

  const handleDelete = useCallback(
    (rule: MetricsExtractionRule) => {
      openConfirmModal({
        onConfirm: () =>
          deleteMetricsExtractionRules(
            {metricsExtractionRules: [rule]},
            {
              onSuccess: () => {
                addSuccessMessage(t('Metric deleted'));
                trackAnalytics('metrics_extractions.delete', {organization});
              },
              onError: () => {
                addErrorMessage(t('Failed to delete metric'));
              },
            }
          ),
        message: t('Are you sure you want to delete this metric?'),
        confirmText: t('Delete Metric'),
      });
    },
    [deleteMetricsExtractionRules, organization]
  );

  const handleEdit = useCallback(
    (rule: MetricsExtractionRule) => {
      openExtractionRuleEditModal({
        organization,
        metricExtractionRule: rule,
        source: 'settings',
      });
    },
    [organization]
  );

  const handleCreate = useCallback(() => {
    openExtractionRuleCreateModal({
      organization,
      projectId: project.id,
      source: 'settings',
    });
  }, [organization, project.id]);

  return (
    <Fragment>
      <SearchWrapper>
        <h6>{t('Span Metrics')}</h6>
        <FlexSpacer />
        <SearchBar
          placeholder={t('Search Metrics')}
          onChange={setQuery}
          query={query}
          size="sm"
        />
        <Button onClick={handleCreate} priority="primary" size="sm">
          {t('Add Metric')}
        </Button>
      </SearchWrapper>
      <RulesTable
        isLoading={isLoadingExtractionRules || isLoadingCardinality}
        onDelete={handleDelete}
        onEdit={handleEdit}
        extractionRules={extractionRules || []}
        cardinality={cardinality || {}}
        hasSearch={!!query}
      />
    </Fragment>
  );
}

interface RulesTableProps {
  cardinality: Record<string, number>;
  extractionRules: MetricsExtractionRule[];
  hasSearch: boolean;
  isLoading: boolean;
  onDelete: (rule: MetricsExtractionRule) => void;
  onEdit: (rule: MetricsExtractionRule) => void;
}

function RulesTable({
  extractionRules,
  cardinality,
  isLoading,
  onDelete,
  onEdit,
  hasSearch,
}: RulesTableProps) {
  const {members} = useMembers();

  const isCardinalityLimited = (rule: MetricsExtractionRule): boolean => {
    const mris = rule.conditions.flatMap(condition => condition.mris);
    return mris.some(conditionMri => cardinality[conditionMri] > 0);
  };

  return (
    <ExtractionRulesPanelTable
      headers={[
        <Cell key="spanAttribute">
          <IconArrow size="xs" direction="down" />
          {t('Span attribute')}
        </Cell>,
        <Cell key="createdBy">{t('Created by')}</Cell>,
        <Cell right key="createdBy">
          {t('Created at')}
        </Cell>,
        <Cell right key="actions">
          {t('Actions')}
        </Cell>,
      ]}
      emptyMessage={
        hasSearch
          ? t('No metrics match the query.')
          : t('You have not created any span metrics yet.')
      }
      isEmpty={extractionRules.length === 0}
      isLoading={isLoading}
    >
      {extractionRules
        .toSorted((a, b) => a?.spanAttribute?.localeCompare(b?.spanAttribute))
        .map(rule => {
          const createdByUser = members.find(
            member => member.id === String(rule.createdById)
          );
          return (
            <Fragment key={rule.spanAttribute + rule.unit}>
              <Cell>
                {isCardinalityLimited(rule) ? (
                  <Tooltip
                    title={t(
                      'Some of your defined queries are exeeding the cardinality limit. Remove tags or add filters to receive accurate data.'
                    )}
                    containerDisplayMode="inline-flex"
                  >
                    <IconWarning
                      size="xs"
                      color="yellow300"
                      role="img"
                      aria-label={t('Exceeding the cardinality limit warning')}
                    />
                  </Tooltip>
                ) : null}
                {rule.spanAttribute}
              </Cell>
              <Cell>
                <UserBadge
                  displayName={createdByUser?.name ?? t('Unknown')}
                  user={createdByUser}
                  hideEmail
                  avatarSize={24}
                />
              </Cell>
              <Cell>
                <DateTime date={rule.dateAdded} />
              </Cell>
              <Cell right>
                <Button
                  aria-label={t('Edit metric')}
                  size="xs"
                  icon={<IconEdit />}
                  borderless
                  onClick={() => onEdit(rule)}
                />
                <Button
                  aria-label={t('Delete metric')}
                  size="xs"
                  icon={<IconDelete />}
                  borderless
                  onClick={() => onDelete(rule)}
                />
              </Cell>
            </Fragment>
          );
        })}
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
  grid-template-columns: 1fr repeat(3, max-content);
`;

const Cell = styled('div')<{right?: boolean}>`
  display: flex;
  align-items: center;
  align-self: stretch;
  gap: ${space(0.5)};
  justify-content: ${p => (p.right ? 'flex-end' : 'flex-start')};
`;
