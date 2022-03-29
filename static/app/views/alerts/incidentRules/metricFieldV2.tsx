import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {InjectedRouter, withRouter} from 'react-router';

import Button from 'sentry/components/button';
import FormField from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import {AlertWizardAlertNames, AlertWizardRuleTemplates, MetricAlertType} from 'sentry/views/alerts/wizard/options';

import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import {Location} from 'history';

type Props = Omit<FormField['props'], 'children'> & {
  location: Location;
  router: InjectedRouter;
};

function MetricFieldV2 (props: Props) {
  const  {location, router, ...fieldProps} = props;

  return (
    <FormField {...fieldProps}>
      {() => {
        const menuOptions = [
          {
            label: t("ERRORS"),
            header: true,
            eventKey: 'errors_section_title',
          },
          {
            label: AlertWizardAlertNames['num_errors'],
            eventKey: 'num_errors',
            template: AlertWizardRuleTemplates['num_errors'],
          },
          {
            label: AlertWizardAlertNames['users_experiencing_errors'],
            eventKey: 'users_experiencing_errors',
            template: AlertWizardRuleTemplates['users_experiencing_errors'],
          },
          {
            label: t("SESSIONS"),
            header: true,
            eventKey: 'sessions_section_title',
          },
          {
            label: AlertWizardAlertNames['crash_free_sessions'],
            eventKey: 'crash_free_sessions',
            template: AlertWizardRuleTemplates['crash_free_sessions'],
          },
          {
            label: AlertWizardAlertNames['crash_free_users'],
            eventKey: 'crash_free_users',
            template: AlertWizardRuleTemplates['crash_free_users'],
          },
          {
            label: t("PERFORMANCE"),
            header: true,
            eventKey: 'performance_section_title',
          },
          {
            label: AlertWizardAlertNames['throughput'],
            eventKey: 'throughput',
            template: AlertWizardRuleTemplates['throughput'],
          },
          {
            label: AlertWizardAlertNames['trans_duration'],
            eventKey: 'trans_duration',
            template: AlertWizardRuleTemplates['trans_duration'],
          },
          {
            label: AlertWizardAlertNames['apdex'],
            eventKey: 'apdex',
            template: AlertWizardRuleTemplates['apdex'],
          },
          {
            label: AlertWizardAlertNames['failure_rate'],
            eventKey: 'failure_rate',
            template: AlertWizardRuleTemplates['failure_rate'],
          },
          {
            label: AlertWizardAlertNames['lcp'],
            eventKey: 'lcp',
            template: AlertWizardRuleTemplates['lcp'],
          },
          {
            label: AlertWizardAlertNames['fid'],
            eventKey: 'fid',
            template: AlertWizardRuleTemplates['fid'],
          },
          {
            label: AlertWizardAlertNames['cls'],
            eventKey: 'cls',
            template: AlertWizardRuleTemplates['cls'],
          },
          {
            label: t("CUSTOM"),
            header: true,
            eventKey: 'custom_section_title',
          },
          {
            label: AlertWizardAlertNames['custom'],
            eventKey: 'custom',
            template: AlertWizardRuleTemplates['custom'],
          },
        ];

        const selected = (menuOptions.find(op => op.template?.aggregate === location.query.aggregate) || menuOptions[1]);

        return (
            <StyledDropdownControl
              label={selected.label}
            >
              {
                menuOptions.map(({label, eventKey, header}) => (<DropdownItem
                  key={eventKey}
                  onSelect={(eventKey: MetricAlertType) => router.replace({
                    ...location,
                    query: {
                      ...location.query,
                      aggregate: AlertWizardRuleTemplates[eventKey].aggregate,
                      dataset: AlertWizardRuleTemplates[eventKey].dataset,
                      eventTypes: AlertWizardRuleTemplates[eventKey].eventTypes,
                    }
                  })}
                  isActive={eventKey === selected.eventKey}
                  eventKey={eventKey}
                  disabled={header}
                >
                  {label}
                </DropdownItem>))
              }
            </StyledDropdownControl>
        );
      }}
    </FormField>
  );
}

export default withRouter(MetricFieldV2);

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

const StyledDropdownControl = styled(DropdownControl)`
  width: 100%;
  button {
    width: 100%;
    span {
      justify-content: space-between;
    }
  }
`;
