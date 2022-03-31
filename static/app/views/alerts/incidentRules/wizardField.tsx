import {InjectedRouter, withRouter} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'sentry/components/button';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import FormField from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {explodeFieldString, generateFieldAsString} from 'sentry/utils/discover/fields';
import {Dataset} from 'sentry/views/alerts/incidentRules/types';
import {
  AlertType,
  AlertWizardAlertNames,
  AlertWizardRuleTemplates,
  MetricAlertType,
} from 'sentry/views/alerts/wizard/options';
import {QueryField} from 'sentry/views/eventsV2/table/queryField';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import {getFieldOptionConfig} from './metricField';

type Props = Omit<FormField['props'], 'children'> & {
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  alertType?: AlertType;
  /**
   * Optionally set a width for each column of selector
   */
  columnWidth?: number;
  inFieldLabels?: boolean;
};

const menuOptions = [
  {
    label: t('ERRORS'),
    header: true,
    key: 'errors_section_title',
  },
  {
    label: AlertWizardAlertNames.num_errors,
    key: 'num_errors',
  },
  {
    label: AlertWizardAlertNames.users_experiencing_errors,
    key: 'users_experiencing_errors',
  },
  {
    label: t('SESSIONS'),
    header: true,
    key: 'sessions_section_title',
  },
  {
    label: AlertWizardAlertNames.crash_free_sessions,
    key: 'crash_free_sessions',
  },
  {
    label: AlertWizardAlertNames.crash_free_users,
    key: 'crash_free_users',
  },
  {
    label: t('PERFORMANCE'),
    header: true,
    key: 'performance_section_title',
  },
  {
    label: AlertWizardAlertNames.throughput,
    key: 'throughput',
  },
  {
    label: AlertWizardAlertNames.trans_duration,
    key: 'trans_duration',
  },
  {
    label: AlertWizardAlertNames.apdex,
    key: 'apdex',
  },
  {
    label: AlertWizardAlertNames.failure_rate,
    key: 'failure_rate',
  },
  {
    label: AlertWizardAlertNames.lcp,
    key: 'lcp',
  },
  {
    label: AlertWizardAlertNames.fid,
    key: 'fid',
  },
  {
    label: AlertWizardAlertNames.cls,
    key: 'cls',
  },
  {
    label: t('CUSTOM'),
    header: true,
    key: 'custom_section_title',
  },
  {
    label: AlertWizardAlertNames.custom,
    key: 'custom',
  },
];

function WizardField({
  location,
  router,
  organization,
  columnWidth,
  inFieldLabels,
  alertType,
  ...fieldProps
}: Props) {
  const selected =
    menuOptions.find(
      op =>
        AlertWizardRuleTemplates[op.key]?.aggregate === location.query.aggregate &&
        AlertWizardRuleTemplates[op.key]?.dataset === location.query.dataset &&
        AlertWizardRuleTemplates[op.key]?.dataset === location.query.dataset
    ) || menuOptions[1];

  return (
    <FormField {...fieldProps}>
      {({onChange, value, model, disabled}) => {
        const dataset = model.getValue('dataset');

        const {fieldOptionsConfig, hidePrimarySelector, hideParameterSelector} =
          getFieldOptionConfig({
            dataset: dataset as Dataset,
            alertType,
          });
        const fieldOptions = generateFieldOptions({organization, ...fieldOptionsConfig});
        const fieldValue = explodeFieldString(value ?? '');

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
            <StyledDropdownControl label={selected.label}>
              {menuOptions.map(({label, key, header}) => (
                <StyledDropdownItem
                  key={key}
                  eventKey={key}
                  onSelect={(eventKey: MetricAlertType) => {
                    const template = AlertWizardRuleTemplates[eventKey];

                    model.setValue('aggregate', template.aggregate);
                    model.setValue('dataset', template.dataset);
                    model.setValue('eventTypes', [template.eventTypes]);
                    router.replace({
                      ...location,
                      query: {
                        ...location.query,
                        ...template,
                      },
                    });
                  }}
                  isActive={key === selected.key}
                  disabled={header}
                  header={header}
                >
                  {label}
                </StyledDropdownItem>
              ))}
            </StyledDropdownControl>
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

export default withRouter(WizardField);

const Container = styled('div')<{hideGap: boolean}>`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${p => (p.hideGap ? space(0) : space(1))};
`;

const StyledDropdownControl = styled(DropdownControl)`
  width: 100%;
  button {
    width: 100%;
    span {
      justify-content: space-between;
    }
  }
`;

const StyledDropdownItem = styled(DropdownItem)<{header?: boolean}>`
  line-height: ${p => p.theme.text.lineHeightBody};
  white-space: nowrap;
  ${p =>
    p.header &&
    css`
      background-color: ${p.theme.backgroundSecondary};
      color: ${p.theme.subText};
      padding: ${space(0.75)} ${space(1.5)};
    `}
  border-top: 1px solid ${p => p.theme.border};
`;

const StyledQueryField = styled(QueryField)<{gridColumns: number; columnWidth?: number}>`
  ${p =>
    p.columnWidth &&
    css`
      width: ${p.gridColumns * p.columnWidth}px;
    `}
`;

const PresetButton = styled(Button)<{disabled: boolean}>`
  ${p =>
    p.disabled &&
    css`
      color: ${p.theme.textColor};
      &:hover,
      &:focus {
        color: ${p.theme.textColor};
      }
    `}
`;

PresetButton.defaultProps = {
  priority: 'link',
  borderless: true,
};
