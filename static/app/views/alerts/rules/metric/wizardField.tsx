import {css} from '@emotion/react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import FormField from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {explodeFieldString, generateFieldAsString} from 'sentry/utils/discover/fields';
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

type Props = Omit<FormField['props'], 'children'> & {
  organization: Organization;
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

  return (
    <FormField {...fieldProps}>
      {({onChange, model, disabled}) => {
        const aggregate = model.getValue('aggregate');
        const dataset: Dataset = model.getValue('dataset');
        const selectedTemplate: AlertType = alertType || 'custom';

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
                // Keep alertType last
                model.setValue('alertType', option.value);
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
