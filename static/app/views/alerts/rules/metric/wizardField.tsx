import {css} from '@emotion/react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import FormField, {FormFieldProps} from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {
  explodeFieldString,
  generateFieldAsString,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {hasDDMFeature} from 'sentry/utils/metrics/features';
import MriField from 'sentry/views/alerts/rules/metric/mriField';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  AlertType,
  AlertWizardAlertNames,
  AlertWizardRuleTemplates,
} from 'sentry/views/alerts/wizard/options';
import {QueryField} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';

import {getFieldOptionConfig} from './metricField';

type MenuOption = {label: string; value: AlertType};
type GroupedMenuOption = {label: string; options: Array<MenuOption>};

type Props = Omit<FormFieldProps, 'children'> & {
  organization: Organization;
  project: Project;
  alertType?: AlertType;
  /**
   * Optionally set a width for each column of selector
   */
  columnWidth?: number;
  inFieldLabels?: boolean;
};

export default function WizardField({
  organization,
  columnWidth,
  inFieldLabels,
  alertType,
  project,
  ...fieldProps
}: Props) {
  const menuOptions: GroupedMenuOption[] = [
    {
      label: t('ERRORS'),
      options: [
        {
          label: AlertWizardAlertNames.num_errors,
          value: 'num_errors',
        },
        {
          label: AlertWizardAlertNames.users_experiencing_errors,
          value: 'users_experiencing_errors',
        },
      ],
    },
    ...((organization.features.includes('crash-rate-alerts')
      ? [
          {
            label: t('SESSIONS'),
            options: [
              {
                label: AlertWizardAlertNames.crash_free_sessions,
                value: 'crash_free_sessions',
              },
              {
                label: AlertWizardAlertNames.crash_free_users,
                value: 'crash_free_users',
              },
            ],
          },
        ]
      : []) as GroupedMenuOption[]),
    {
      label: t('PERFORMANCE'),
      options: [
        {
          label: AlertWizardAlertNames.throughput,
          value: 'throughput',
        },
        {
          label: AlertWizardAlertNames.trans_duration,
          value: 'trans_duration',
        },
        {
          label: AlertWizardAlertNames.apdex,
          value: 'apdex',
        },
        {
          label: AlertWizardAlertNames.failure_rate,
          value: 'failure_rate',
        },
        {
          label: AlertWizardAlertNames.lcp,
          value: 'lcp',
        },
        {
          label: AlertWizardAlertNames.fid,
          value: 'fid',
        },
        {
          label: AlertWizardAlertNames.cls,
          value: 'cls',
        },
        ...(hasDDMFeature(organization)
          ? [
              {
                label: AlertWizardAlertNames.custom_transactions,
                value: 'custom_transactions' as const,
              },
            ]
          : []),
      ],
    },
    {
      label: hasDDMFeature(organization) ? t('METRICS') : t('CUSTOM'),
      options: [
        hasDDMFeature(organization)
          ? {
              label: AlertWizardAlertNames.custom_metrics,
              value: 'custom_metrics',
            }
          : {
              label: AlertWizardAlertNames.custom_transactions,
              value: 'custom_transactions',
            },
      ],
    },
  ];

  return (
    <FormField {...fieldProps}>
      {({onChange, model, disabled}) => {
        const aggregate = model.getValue('aggregate');
        const dataset: Dataset = model.getValue('dataset');
        const selectedTemplate: AlertType = alertType || 'custom_metrics';

        const {fieldOptionsConfig, hidePrimarySelector, hideParameterSelector} =
          getFieldOptionConfig({
            dataset: dataset as Dataset,
            alertType,
          });
        const fieldOptions = generateFieldOptions({organization, ...fieldOptionsConfig});
        const fieldValue = getFieldValue(aggregate ?? '', model);

        const fieldKey =
          fieldValue?.kind === FieldValueKind.FUNCTION
            ? `function:${fieldValue.function[0]}`
            : '';

        const selectedField = fieldOptions[fieldKey]?.value;
        const numParameters: number =
          selectedField?.kind === FieldValueKind.FUNCTION
            ? selectedField.meta.parameters.length
            : 0;

        const gridColumns =
          1 +
          numParameters -
          (hideParameterSelector ? 1 : 0) -
          (hidePrimarySelector ? 1 : 0);

        return (
          <Container hideGap={gridColumns < 1}>
            <SelectControl
              value={selectedTemplate}
              options={menuOptions}
              disabled={disabled}
              onChange={(option: MenuOption) => {
                const template = AlertWizardRuleTemplates[option.value];

                model.setValue('aggregate', template.aggregate);
                model.setValue('dataset', template.dataset);
                model.setValue('eventTypes', [template.eventTypes]);
                // Keep alertType last
                model.setValue('alertType', option.value);
              }}
            />
            {hasDDMFeature(organization) && alertType === 'custom_metrics' ? (
              <MriField
                project={project}
                aggregate={aggregate}
                onChange={newAggregate => onChange(newAggregate, {})}
              />
            ) : (
              <StyledQueryField
                filterPrimaryOptions={option =>
                  option.value.kind === FieldValueKind.FUNCTION
                }
                fieldOptions={fieldOptions}
                fieldValue={fieldValue}
                onChange={v => onChange(generateFieldAsString(v), {})}
                columnWidth={columnWidth}
                gridColumns={gridColumns}
                inFieldLabels={inFieldLabels}
                shouldRenderTag={false}
                disabled={disabled}
                hideParameterSelector={hideParameterSelector}
                hidePrimarySelector={hidePrimarySelector}
              />
            )}
          </Container>
        );
      }}
    </FormField>
  );
}

// swaps out custom percentile values for known percentiles, used while we fade out custom percentiles in metric alerts
// TODO(telemetry-experience): remove once we migrate all custom percentile alerts
const getFieldValue = (aggregate: string | undefined, model) => {
  const fieldValue = explodeFieldString(aggregate ?? '');

  if (fieldValue?.kind !== FieldValueKind.FUNCTION) {
    return fieldValue;
  }

  if (fieldValue.function[0] !== 'percentile') {
    return fieldValue;
  }

  const newFieldValue: QueryFieldValue = {
    kind: FieldValueKind.FUNCTION,
    function: [
      getApproximateKnownPercentile(fieldValue.function[2] as string),
      fieldValue.function[1],
      undefined,
      undefined,
    ],
    alias: fieldValue.alias,
  };

  model.setValue('aggregate', generateFieldAsString(newFieldValue));

  return newFieldValue;
};

const getApproximateKnownPercentile = (customPercentile: string) => {
  const percentile = parseFloat(customPercentile);

  if (percentile <= 0.5) {
    return 'p50';
  }
  if (percentile <= 0.75) {
    return 'p75';
  }
  if (percentile <= 0.9) {
    return 'p90';
  }
  if (percentile <= 0.95) {
    return 'p95';
  }
  if (percentile <= 0.99) {
    return 'p99';
  }
  return 'p100';
};

const Container = styled('div')<{hideGap: boolean}>`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${p => (p.hideGap ? space(0) : space(1))};
`;

const StyledQueryField = styled(QueryField)<{gridColumns: number; columnWidth?: number}>`
  ${p =>
    p.columnWidth &&
    css`
      width: ${p.gridColumns * p.columnWidth}px;
    `}
`;
