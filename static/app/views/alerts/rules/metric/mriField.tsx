import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import Tag from 'sentry/components/tag';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {parseFunction} from 'sentry/utils/discover/fields';
import {getReadableMetricType, isAllowedOp, useMetricsMeta} from 'sentry/utils/metrics';

interface Props {
  aggregate: string;
  onChange: (value: string, meta: Record<string, any>) => void;
  project: Project;
}

function parseAggregate(aggregate: string) {
  const parsedFunction = parseFunction(aggregate);
  if (!parsedFunction) {
    // Assumption: we only allow aggregate functions for custom metric alerts
    return {
      mri: null,
      op: null,
    };
    // throw new Error('Invalid aggregate for metrics');
  }
  return {
    mri: parsedFunction.arguments[0],
    op: parsedFunction.name,
  };
}

function getSortedMriOperations(operations: string[]) {
  return operations.filter(isAllowedOp).sort((a, b) => a.localeCompare(b));
}

function MriField({aggregate, project, onChange}: Props) {
  const meta = useMetricsMeta([parseInt(project.id, 10)], {
    useCases: ['transactions', 'custom'],
  });
  const metaArr = useMemo(() => {
    return Object.values(meta).sort((a, b) => a.name.localeCompare(b.name));
  }, [meta]);

  const selectedValues = parseAggregate(aggregate);
  const selectedMriMeta = selectedValues.mri ? meta[selectedValues.mri] : null;

  useEffect(() => {
    // auto select first mri if none of the available ones is selected
    if (!selectedMriMeta && metaArr.length > 0) {
      const newSelection = metaArr[0];
      onChange(
        `${getSortedMriOperations(newSelection.operations)[0]}(${newSelection.mri})`,
        {}
      );
    }
  }, [metaArr, onChange, selectedMriMeta]);

  const operationOptions = useMemo(
    () =>
      getSortedMriOperations(selectedMriMeta?.operations ?? []).map(op => ({
        label: op,
        value: op,
      })),
    [selectedMriMeta]
  );

  return (
    <Wrapper>
      <StyledSelectControl
        searchable
        sizeLimit={100}
        placeholder={t('Select a metric')}
        options={metaArr.map(metric => ({
          label: metric.name,
          value: metric.mri,
          trailingItems: (
            <Fragment>
              <Tag tooltipText={t('Type')}>{getReadableMetricType(metric.type)}</Tag>
              <Tag tooltipText={t('Unit')}>{metric.unit}</Tag>
            </Fragment>
          ),
        }))}
        value={selectedValues.mri}
        onChange={option => {
          const availableOps = getSortedMriOperations(meta[option.value].operations);
          const selectedOp =
            selectedValues.op && availableOps.includes(selectedValues.op)
              ? selectedValues.op
              : availableOps[0];
          onChange(`${selectedOp}(${option.value})`, {});
        }}
      />
      <StyledSelectControl
        searchable
        disabled={!selectedValues.mri}
        placeholder={t('Select an operation')}
        options={operationOptions}
        value={selectedValues.op}
        onChange={option => {
          onChange(`${option.value}(${selectedValues.mri})`, {});
        }}
      />
    </Wrapper>
  );
}

export default MriField;

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: 1fr 1fr;
`;

const StyledSelectControl = styled(SelectControl)`
  width: 200px;
`;
