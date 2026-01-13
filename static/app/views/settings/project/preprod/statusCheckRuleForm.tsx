import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {NumberInput} from 'sentry/components/core/input/numberInput';
import {Flex, Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {PreprodSearchBar} from 'sentry/components/preprod/preprodSearchBar';
import {t} from 'sentry/locale';

import {SectionLabel} from './statusCheckSharedComponents';
import type {StatusCheckRule} from './types';
import {
  getMeasurementLabel,
  getMetricLabel,
  getUnitForMeasurement,
  MEASUREMENT_OPTIONS,
  METRIC_OPTIONS,
} from './types';

interface Props {
  onDelete: () => void;
  onSave: (rule: StatusCheckRule) => void;
  rule: StatusCheckRule;
}

export function StatusCheckRuleForm({rule, onSave, onDelete}: Props) {
  const [metric, setMetric] = useState(rule.metric);
  const [measurement, setMeasurement] = useState(rule.measurement);
  const [value, setValue] = useState(rule.value);
  const [filterQuery, setFilterQuery] = useState(rule.filterQuery ?? '');

  const unit = getUnitForMeasurement(measurement);

  const handleSave = () => {
    onSave({
      ...rule,
      filterQuery,
      measurement,
      metric,
      unit,
      value,
    });
  };

  const handleQueryChange = useCallback((query: string) => {
    setFilterQuery(query);
  }, []);

  const handleDelete = () => {
    const valueWithUnit =
      rule.unit === '%' ? `${rule.value}%` : `${rule.value} ${rule.unit}`;
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
          <StyledNumberInput value={value} onChange={v => setValue(v ?? 0)} min={0} />
          <Text variant="muted">{unit}</Text>
        </Flex>
      </Flex>

      <Stack gap="sm">
        <SectionLabel>{t('For')}</SectionLabel>
        <PreprodSearchBar
          initialQuery={filterQuery}
          onChange={(query, _state) => handleQueryChange(query)}
          searchSource="preprod_status_check_filters"
          portalTarget={document.body}
          allowedKeys={[
            'app_id',
            'git_head_ref',
            'build_configuration_name',
            'platform_name',
          ]}
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
