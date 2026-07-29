import {type ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {NumberInput} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {openConfirmModal} from 'sentry/components/confirm';
import {PreprodSearchBar} from 'sentry/components/preprod/preprodSearchBar';
import {t} from 'sentry/locale';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {SectionLabel} from './statusCheckSharedComponents';
import type {ArtifactType, StatusCheckRule} from './types';
import {
  ARTIFACT_TYPE_OPTIONS,
  bytesToMB,
  DEFAULT_ARTIFACT_TYPE,
  getDisplayUnit,
  getMeasurementLabel,
  getMetricLabel,
  mbToBytes,
  MEASUREMENT_OPTIONS,
  METRIC_OPTIONS,
  STATUS_CHECK_ALLOWED_FILTER_KEYS,
} from './types';

export interface RuleFormCopy {
  deleteConfirmHeader: string;
  deleteConfirmMessage: (ruleDescription: string, valueWithUnit: string) => ReactNode;
  headerLabel: string;
  searchSource: string;
}

const DEFAULT_COPY: RuleFormCopy = {
  headerLabel: t('Fail Status Check When'),
  deleteConfirmHeader: t('Are you sure you want to delete this status check rule?'),
  deleteConfirmMessage: (ruleDescription, valueWithUnit) => (
    <span>
      Will no longer fail status checks when <strong>{ruleDescription}</strong> surpasses{' '}
      <strong>{valueWithUnit}</strong>
    </span>
  ),
  searchSource: 'preprod_status_check_filters',
};

interface Props {
  onDelete: () => void;
  onSave: (rule: StatusCheckRule) => void;
  rule: StatusCheckRule;
  copy?: RuleFormCopy;
}

export function StatusCheckRuleForm({
  rule,
  onSave,
  onDelete,
  copy = DEFAULT_COPY,
}: Props) {
  const {project} = useProjectSettingsOutlet();
  const [metric, setMetric] = useState(rule.metric);
  const [measurement, setMeasurement] = useState(rule.measurement);
  const displayUnit = getDisplayUnit(measurement);
  const initialDisplayValue = displayUnit === '%' ? rule.value : bytesToMB(rule.value);
  const [displayValue, setDisplayValue] = useState(initialDisplayValue);
  const [filterQuery, setFilterQuery] = useState(rule.filterQuery ?? '');
  const [artifactType, setArtifactType] = useState<ArtifactType>(
    rule.artifactType ?? DEFAULT_ARTIFACT_TYPE
  );

  const currentValueInBytes =
    displayUnit === '%' ? displayValue : mbToBytes(displayValue);
  const isDirty =
    metric !== rule.metric ||
    measurement !== rule.measurement ||
    currentValueInBytes !== rule.value ||
    filterQuery !== (rule.filterQuery ?? '') ||
    artifactType !== (rule.artifactType ?? DEFAULT_ARTIFACT_TYPE);

  const handleSave = () => {
    onSave({
      ...rule,
      filterQuery,
      measurement,
      metric,
      value: currentValueInBytes,
      artifactType,
    });
  };

  const handleQueryChange = (query: string) => {
    setFilterQuery(query);
  };

  const handleDelete = () => {
    const ruleDisplayValue =
      getDisplayUnit(rule.measurement) === '%' ? rule.value : bytesToMB(rule.value);
    const valueWithUnit = `${ruleDisplayValue} ${getDisplayUnit(rule.measurement)}`;
    const ruleDescription = `${getMetricLabel(rule.metric)} - ${getMeasurementLabel(rule.measurement)}`;

    openConfirmModal({
      header: (
        <Text size="lg" bold>
          {copy.deleteConfirmHeader}
        </Text>
      ),
      message: copy.deleteConfirmMessage(ruleDescription, valueWithUnit),
      confirmText: t('Delete Rule'),
      priority: 'danger',
      onConfirm: onDelete,
    });
  };

  return (
    <Stack gap="md" paddingTop="md" paddingBottom="md">
      <SectionLabel>{copy.headerLabel}</SectionLabel>

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
        <SectionLabel>{t('Artifact Type')}</SectionLabel>
        <CompactSelect
          value={artifactType}
          options={ARTIFACT_TYPE_OPTIONS}
          onChange={opt => setArtifactType(opt.value)}
        />
      </Stack>

      <Stack gap="sm">
        <SectionLabel>{t('For')}</SectionLabel>
        <PreprodSearchBar
          initialQuery={filterQuery}
          projects={[Number(project.id)]}
          onChange={(query, _state) => handleQueryChange(query)}
          searchSource={copy.searchSource}
          portalTarget={document.body}
          disallowFreeText
          disallowHas
          disallowLogicalOperators
          allowedKeys={STATUS_CHECK_ALLOWED_FILTER_KEYS}
        />
      </Stack>

      <Flex gap="md" marginTop="sm">
        <Button variant="primary" onClick={handleSave} disabled={!isDirty}>
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
