import {css} from '@emotion/react';
import styled from '@emotion/styled';
import findKey from 'lodash/findKey';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import FormField from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {
  AggregationKeyWithAlias,
  AggregationRefinement,
  explodeFieldString,
  generateFieldAsString,
} from 'sentry/utils/discover/fields';
import {
  Dataset,
  EventTypes,
  SessionsAggregate,
} from 'sentry/views/alerts/rules/metric/types';
import {
  AlertType,
  AlertWizardAlertNames,
  AlertWizardRuleTemplates,
  WizardRuleTemplate,
} from 'sentry/views/alerts/wizard/options';
import {QueryField} from 'sentry/views/eventsV2/table/queryField';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import {getFieldOptionConfig} from './metricField';

type WizardAggregateFunctionValue = {
  function: [
    AggregationKeyWithAlias,
    string,
    AggregationRefinement,
    AggregationRefinement
  ];
  kind: 'function';
  alias?: string;
};

type WizardAggregateFieldValue = {
  field: string;
  kind: 'field';
  alias?: string;
};

type MenuOption = {label: string; value: AlertType};

type Props = Omit<FormField['props'], 'children'> & {
  organization: Organization;
  alertType?: AlertType;
  /**
   * Optionally set a width for each column of selector
   */
  columnWidth?: number;
  inFieldLabels?: boolean;
};

const menuOptions: {label: string; options: Array<MenuOption>}[] = [
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
    ],
  },

  {
    label: t('CUSTOM'),
    options: [
      {
        label: AlertWizardAlertNames.custom,
        value: 'custom',
      },
    ],
  },
];

export default function WizardField({
  organization,
  columnWidth,
  inFieldLabels,
  alertType,
  ...fieldProps
}: Props) {
  const matchTemplateAggregate = (
    template: WizardRuleTemplate,
    aggregate: string
  ): boolean => {
    const templateFieldValue = explodeFieldString(template.aggregate) as
      | WizardAggregateFieldValue
      | WizardAggregateFunctionValue;
    const aggregateFieldValue = explodeFieldString(aggregate) as
      | WizardAggregateFieldValue
      | WizardAggregateFunctionValue;

    if (template.aggregate === aggregate) {
      return true;
    }

    if (
      templateFieldValue.kind !== 'function' ||
      aggregateFieldValue.kind !== 'function'
    ) {
      return false;
    }

    if (
      templateFieldValue.function?.[0] === 'apdex' &&
      aggregateFieldValue.function?.[0] === 'apdex'
    ) {
      return true;
    }

    return templateFieldValue.function?.[1] && aggregateFieldValue.function?.[1]
      ? templateFieldValue.function?.[1] === aggregateFieldValue.function?.[1]
      : templateFieldValue.function?.[0] === aggregateFieldValue.function?.[0];
  };

  const matchTemplateDataset = (
    template: WizardRuleTemplate,
    dataset: Dataset
  ): boolean =>
    template.dataset === dataset ||
    (organization.features.includes('alert-crash-free-metrics') &&
      (template.aggregate === SessionsAggregate.CRASH_FREE_SESSIONS ||
        template.aggregate === SessionsAggregate.CRASH_FREE_USERS) &&
      dataset === Dataset.METRICS);

  const matchTemplateEventTypes = (
    template: WizardRuleTemplate,
    eventTypes: EventTypes[],
    aggregate: string
  ): boolean =>
    aggregate === SessionsAggregate.CRASH_FREE_SESSIONS ||
    aggregate === SessionsAggregate.CRASH_FREE_USERS ||
    eventTypes.includes(template.eventTypes);

  return (
    <FormField {...fieldProps}>
      {({onChange, model, disabled}) => {
        const aggregate = model.getValue('aggregate');
        const dataset: Dataset = model.getValue('dataset');
        const eventTypes = [...(model.getValue('eventTypes') ?? [])];

        const selectedTemplate: AlertType =
          alertType === 'custom'
            ? alertType
            : (findKey(
                AlertWizardRuleTemplates,
                template =>
                  matchTemplateAggregate(template, aggregate) &&
                  matchTemplateDataset(template, dataset) &&
                  matchTemplateEventTypes(template, eventTypes, aggregate)
              ) as AlertType) || 'num_errors';

        const {fieldOptionsConfig, hidePrimarySelector, hideParameterSelector} =
          getFieldOptionConfig({
            dataset: dataset as Dataset,
            alertType,
          });
        const fieldOptions = generateFieldOptions({organization, ...fieldOptionsConfig});
        const fieldValue = explodeFieldString(aggregate ?? '');

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
              onChange={(option: MenuOption) => {
                const template = AlertWizardRuleTemplates[option.value];

                model.setValue('aggregate', template.aggregate);
                model.setValue('dataset', template.dataset);
                model.setValue('eventTypes', [template.eventTypes]);
              }}
            />
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
          </Container>
        );
      }}
    </FormField>
  );
}

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
