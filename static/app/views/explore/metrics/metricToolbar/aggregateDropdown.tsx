import {Fragment, useMemo} from 'react';

import {Badge} from '@sentry/scraps/badge';
import {
  CompositeSelect,
  type SelectOption,
  type SelectSection,
  TriggerLabel,
} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {
  DEFAULT_YAXIS_BY_TYPE,
  GROUPED_OPTIONS_BY_TYPE,
} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricVisualize,
  useMetricVisualizes,
  useSetMetricVisualizes,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  DEFAULT_SCORE_FORMULA,
  getScoreFormulaByKey,
  isScoreFormulaMetric,
  SCORE_FORMULAS,
} from 'sentry/views/explore/metrics/scoreFormulas';
import {updateVisualizeYAxis} from 'sentry/views/explore/metrics/utils';
import {
  isVisualizeFunction,
  type VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

const MULTI_SELECT_GROUP_KEYS = new Set(['percentiles', 'stats']);

/** The only functions the score formulas' stand-in metric offers. */
const SCORE_FORMULA_GROUPS: Array<SelectSection<string>> = [
  {
    key: 'scores',
    label: t('Scores'),
    options: SCORE_FORMULAS.map(formula => ({
      label: formula.key,
      value: formula.key,
      tooltip: formula.description,
    })),
  },
];

function withAggregate(
  visualize: VisualizeFunction,
  aggregate: string,
  traceMetric: TraceMetric
): VisualizeFunction {
  // A formula's y-axis is fixed, so it does not get the metric spliced in
  const formula = getScoreFormulaByKey(aggregate);
  return formula
    ? visualize.replace({yAxis: formula.yAxis})
    : updateVisualizeYAxis(visualize, aggregate, traceMetric);
}

export function AggregateDropdown({
  traceMetric,
  singleSelect = false,
  disabledReason,
  disabledAggregates,
}: {
  traceMetric: TraceMetric;
  disabledAggregates?: Record<string, string>;
  disabledReason?: string;
  singleSelect?: boolean;
}) {
  const visualize = useMetricVisualize();
  const visualizes = useMetricVisualizes();
  const setMetricVisualizes = useSetMetricVisualizes();
  const isDisabled = disabledReason !== undefined;
  const isScoresMetric = isScoreFormulaMetric(traceMetric);
  const defaultAggregate = isScoresMetric
    ? DEFAULT_SCORE_FORMULA.key
    : DEFAULT_YAXIS_BY_TYPE[traceMetric.type];

  const groups = useMemo(() => {
    const allGroups = isScoresMetric
      ? SCORE_FORMULA_GROUPS
      : (GROUPED_OPTIONS_BY_TYPE[traceMetric.type] ?? []);
    if (!disabledAggregates) {
      return allGroups;
    }
    return allGroups.map(group => ({
      ...group,
      options: group.options.map(opt =>
        disabledAggregates[opt.value]
          ? {
              ...opt,
              disabled: true,
              tooltip: disabledAggregates[opt.value],
            }
          : opt
      ),
    }));
  }, [traceMetric.type, disabledAggregates, isScoresMetric]);
  const selectedNames = new Set(
    visualizes.map(v => (isVisualizeFunction(v) ? (v.parsedFunction?.name ?? '') : ''))
  );

  function handleChange(selectedOptions: Array<SelectOption<string>>) {
    if (!isVisualizeFunction(visualize)) {
      return;
    }
    if (selectedOptions.length === 0) {
      setMetricVisualizes([withAggregate(visualize, defaultAggregate!, traceMetric)]);
    } else {
      setMetricVisualizes(
        selectedOptions.map(o => withAggregate(visualize, o.value, traceMetric))
      );
    }
  }

  const selectedList = [...selectedNames].filter(Boolean);
  const isDefaultSelection =
    selectedList.length === 1 && selectedList[0] === defaultAggregate;

  return (
    <CompositeSelect
      disabled={isDisabled || groups.length === 0}
      menuHeaderTrailingItems={
        // Without a menu title, a hidden Clear button would leave an empty header.
        isDefaultSelection
          ? undefined
          : () => <CompositeSelect.ClearButton onClick={() => handleChange([])} />
      }
      style={{width: '100%'}}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          tooltipProps={{title: disabledReason}}
          prefix={t('Agg')}
          style={{width: '100%'}}
        >
          {selectedList.length === 0 ? (
            <TriggerLabel>{t('None')}</TriggerLabel>
          ) : (
            <Fragment>
              <TriggerLabel>{selectedList[0]}</TriggerLabel>
              {selectedList.length > 1 && (
                <Badge
                  variant="muted"
                  style={{marginLeft: 4, flexShrink: 0, top: 'auto'}}
                >
                  {`+${selectedList.length - 1}`}
                </Badge>
              )}
            </Fragment>
          )}
        </OverlayTrigger.Button>
      )}
    >
      {groups.map(group => {
        const groupKey = String(group.key);
        const isMulti = !singleSelect && MULTI_SELECT_GROUP_KEYS.has(groupKey);
        const options = group.options.map<SelectOption<string>>(option => ({
          ...option,
          trailingItems: state => (
            <Fragment>
              {typeof option.trailingItems === 'function'
                ? option.trailingItems(state)
                : option.trailingItems}
              <TypeBadge kind={FieldKind.FUNCTION} />
            </Fragment>
          ),
        }));
        const activeValues = group.options
          .map(opt => String(opt.value))
          .filter(v => selectedNames.has(v));

        if (isMulti) {
          return (
            <CompositeSelect.Region
              key={groupKey}
              label={group.label}
              multiple
              options={options}
              value={activeValues}
              onChange={handleChange}
            />
          );
        }

        return (
          <CompositeSelect.Region
            key={groupKey}
            label={group.label}
            options={options}
            value={activeValues[0]}
            onChange={opt => handleChange([opt])}
          />
        );
      })}
    </CompositeSelect>
  );
}
