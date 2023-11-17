import {Fragment, useCallback, useEffect, useMemo} from 'react';
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

export function buildAggregate(mri: string, op: string) {
  return `${op}(${mri})`;
}

export function parseAggregate(aggregate: string) {
  const parsedFunction = parseFunction(aggregate);
  if (!parsedFunction) {
    // We only allow aggregate functions for custom metric alerts
    return {
      mri: undefined,
      op: undefined,
    };
  }
  return {
    mri: parsedFunction.arguments[0],
    op: parsedFunction.name,
  };
}

function filterAndSortOperations(operations: string[]) {
  return operations.filter(isAllowedOp).sort((a, b) => a.localeCompare(b));
}

function MriField({aggregate, project, onChange}: Props) {
  const {data: meta} = useMetricsMeta([parseInt(project.id, 10)], {
    useCases: ['transactions', 'custom'],
  });
  const metaArr = useMemo(() => {
    return Object.values(meta).sort((a, b) => a.name.localeCompare(b.name));
  }, [meta]);

  const selectedValues = parseAggregate(aggregate);
  const selectedMriMeta = selectedValues.mri ? meta[selectedValues.mri] : null;

  useEffect(() => {
    // Auto-select the first mri if none of the available ones is selected
    if (!selectedMriMeta && metaArr.length > 0) {
      const newSelection = metaArr[0];
      onChange(
        buildAggregate(
          newSelection.mri,
          filterAndSortOperations(newSelection.operations)[0]
        ),
        {}
      );
    }
  }, [metaArr, onChange, selectedMriMeta]);

  const handleMriChange = useCallback(
    option => {
      // Make sure that the selected operation matches the new metric
      const availableOps = filterAndSortOperations(meta[option.value].operations);
      const selectedOp =
        selectedValues.op && availableOps.includes(selectedValues.op)
          ? selectedValues.op
          : availableOps[0];
      onChange(buildAggregate(option.value, selectedOp), {});
    },
    [meta, onChange, selectedValues.op]
  );

  const operationOptions = useMemo(
    () =>
      filterAndSortOperations(selectedMriMeta?.operations ?? []).map(op => ({
        label: op,
        value: op,
      })),
    [selectedMriMeta]
  );

  // As SelectControl does not support an options size limit out of the box
  // we work around it by using the async variant of the control
  const getMriOptions = useCallback(
    (searchText: string) => {
      const filteredMeta = metaArr.filter(
        ({name}) =>
          searchText === '' || name.toLowerCase().includes(searchText.toLowerCase())
      );

      const options = filteredMeta.splice(0, 100).map<{
        label: React.ReactNode;
        value: string;
        disabled?: boolean;
        trailingItems?: React.ReactNode;
      }>(metric => ({
        label: metric.name,
        value: metric.mri,
        trailingItems: (
          <Fragment>
            <Tag tooltipText={t('Type')}>{getReadableMetricType(metric.type)}</Tag>
            <Tag tooltipText={t('Unit')}>{metric.unit}</Tag>
          </Fragment>
        ),
      }));

      if (filteredMeta.length > options.length) {
        options.push({
          label: (
            <SizeLimitMessage>{t('Use search to find more options…')}</SizeLimitMessage>
          ),
          value: '',
          disabled: true,
        });
      }
      return options;
    },
    [metaArr]
  );

  // When using the async variant of SelectControl, we need to pass in an option object instead of just the value
  const selectedOption = selectedMriMeta && {
    label: selectedMriMeta.name,
    value: selectedMriMeta.mri,
  };

  return (
    <Wrapper>
      <StyledSelectControl
        searchable
        placeholder={t('Select a metric')}
        async
        defaultOptions={getMriOptions('')}
        loadOptions={searchText => Promise.resolve(getMriOptions(searchText))}
        filterOption={() => true}
        value={selectedOption}
        onChange={handleMriChange}
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

const SizeLimitMessage = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: block;
  width: 100%;
  text-align: center;
`;
