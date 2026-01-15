import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {NumberInput} from 'sentry/components/core/input/numberInput';
import {Flex, Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';

import {SectionLabel} from './statusCheckSharedComponents';
import type {StatusCheckRule} from './types';
import {
  bytesToMB,
  getDisplayUnit,
  getMeasurementLabel,
  getMetricLabel,
  mbToBytes,
  MEASUREMENT_OPTIONS,
  METRIC_OPTIONS,
} from './types';

interface Props {
  onDelete: () => void;
  onSave: (rule: StatusCheckRule) => void;
  rule: StatusCheckRule;
}

const FILTER_KEYS: TagCollection = {
  platform: {key: 'platform', name: 'Platform'},
  app_id: {key: 'app_id', name: 'App ID'},
  build_configuration: {
    key: 'build_configuration',
    name: 'Build Configuration',
  },
  git_head_ref: {key: 'git_head_ref', name: 'Branch'},
};

const getTagValues = (
  tag: {key: string; name: string},
  _searchQuery: string
): Promise<string[]> => {
  if (tag.key === 'platform') {
    return Promise.resolve(['android', 'ios']);
  }
  return Promise.resolve([]);
};

export function StatusCheckRuleForm({rule, onSave, onDelete}: Props) {
  const [metric, setMetric] = useState(rule.metric);
  const [measurement, setMeasurement] = useState(rule.measurement);
  const displayUnit = getDisplayUnit(measurement);
  const initialDisplayValue = displayUnit === '%' ? rule.value : bytesToMB(rule.value);
  const [displayValue, setDisplayValue] = useState(initialDisplayValue);
  const [filterQuery, setFilterQuery] = useState(rule.filterQuery ?? '');

  const handleSave = () => {
    const valueInBytes = displayUnit === '%' ? displayValue : mbToBytes(displayValue);
    onSave({
      ...rule,
      filterQuery,
      measurement,
      metric,
      value: valueInBytes,
    });
  };

  const handleQueryChange = useCallback((query: string) => {
    setFilterQuery(query);
  }, []);

  const handleDelete = () => {
    const ruleDisplayValue =
      getDisplayUnit(rule.measurement) === '%' ? rule.value : bytesToMB(rule.value);
    const valueWithUnit = `${ruleDisplayValue} ${getDisplayUnit(rule.measurement)}`;
    const ruleDescription = `${getMetricLabel(rule.metric)} - ${getMeasurementLabel(rule.measurement)}`;

    openConfirmModal({
      header: (
        <Text size="lg" bold>
          {t('Are you sure you want to delete this status check rule?')}
        </Text>
      ),
      message: (
        <span>
          Will no longer fail status checks when <strong>{ruleDescription}</strong>{' '}
          surpasses <strong>{valueWithUnit}</strong>
        </span>
      ),
      confirmText: t('Delete Rule'),
      priority: 'danger',
      onConfirm: onDelete,
    });
  };

  return (
    <Stack gap="md" paddingTop="md" paddingBottom="md">
      <SectionLabel>{t('Fail Status Check When')}</SectionLabel>

      <Flex align="center" gap="md" wrap="wrap">
        <CompactSelect
          value={metric}
          options={METRIC_OPTIONS}
          onChange={opt => setMetric(opt.value)}
        />
        <Text variant="muted">:</Text>
        <CompactSelect
          value={measurement}
          options={MEASUREMENT_OPTIONS}
          onChange={opt => setMeasurement(opt.value)}
        />
        <Text variant="muted">{t('is greater than')}</Text>
        <Flex align="center" gap="xs">
          <StyledNumberInput
            value={displayValue}
            onChange={v => setDisplayValue(v ?? 0)}
            min={0}
          />
          <Text variant="muted">{displayUnit}</Text>
        </Flex>
      </Flex>

      <Stack gap="sm">
        <SectionLabel>{t('For')}</SectionLabel>
        <SearchQueryBuilder
          filterKeys={FILTER_KEYS}
          getTagValues={getTagValues}
          initialQuery={filterQuery}
          onChange={handleQueryChange}
          searchSource="preprod_status_check_filters"
          disallowFreeText
          disallowLogicalOperators
          placeholder={t('Add build filters...')}
          portalTarget={document.body}
        />
      </Stack>

      <Flex gap="md" marginTop="sm">
        <Button priority="primary" onClick={handleSave}>
          {t('Save Rule')}
        </Button>
        <Button onClick={handleDelete}>{t('Delete Rule')}</Button>
      </Flex>
    </Stack>
  );
}

const StyledNumberInput = styled(NumberInput)`
  width: 100px;
`;
