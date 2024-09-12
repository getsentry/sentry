import {useRef, useState} from 'react';
import styled from '@emotion/styled';

import type {APIRequestMethod} from 'sentry/api';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldLabel from 'sentry/components/forms/fieldGroup/fieldLabel';
import FieldWrapper from 'sentry/components/forms/fieldGroup/fieldWrapper';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryMemberTeamSelectorField from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import Form, {type FormProps} from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {IconAdd, IconLab, IconNot} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import type {UptimeAlert} from 'sentry/views/alerts/types';

interface Props {
  apiMethod: APIRequestMethod;
  apiUrl: string;
  initialData: Record<string, any>;
  onSubmitSuccess: FormProps['onSubmitSuccess'];
  project: Project;
  handleDelete?: () => void;
  rule?: UptimeAlert;
}

const HTTP_METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'HEAD'];

const ENABLED_CONFIGURATION = true;

export function UptimeAlertForm({
  initialData,
  apiUrl,
  apiMethod,
  rule,
  handleDelete,
  project,
  onSubmitSuccess,
}: Props) {
  const [numHeaders, setNumHeaders] = useState<number>(1);
  const form = useRef(new FormModel());

  return (
    <UptimeForm
      apiMethod={apiMethod}
      apiEndpoint={apiUrl}
      model={form.current}
      saveOnBlur={false}
      initialData={initialData}
      onSubmitSuccess={onSubmitSuccess}
      extraButton={
        rule ? (
          <Confirm
            message={t(
              'Are you sure you want to delete "%s"? Once deleted, this alert cannot be recreated automatically.',
              rule.name
            )}
            header={<h5>{t('Delete Uptime Rule?')}</h5>}
            priority="danger"
            confirmText={t('Delete Rule')}
            onConfirm={handleDelete}
          >
            <Button priority="danger">{t('Delete Rule')}</Button>
          </Confirm>
        ) : undefined
      }
    >
      <Alert type="info" showIcon icon={<IconLab />}>
        {t(
          'Uptime Monitoring is currently in Early Access. Additional configuration options will be available soon.'
        )}
      </Alert>
      <List symbol="colored-numeric">
        <AlertListItem>{t('Select an environment and project')}</AlertListItem>
        <FormRow>
          <SentryProjectSelectorField
            name="projectSlug"
            label={t('Project')}
            hideLabel
            projects={[project]}
            valueIsSlug
            inline={false}
            flexibleControlStateSize
            stacked
          />
          <SelectField
            name="environment"
            label={t('Environment')}
            hideLabel
            placeholder={t('Production')}
            inline={false}
            flexibleControlStateSize
            stacked
          />
        </FormRow>
        <AlertListItem>{t('Configure Request')}</AlertListItem>
        <Panel>
          <PanelBody>
            <ConfigurationGrid>
              <FieldLabel disabled={!ENABLED_CONFIGURATION}>{t('URL')}</FieldLabel>
              <TextField
                disabled={!ENABLED_CONFIGURATION}
                name="url"
                label={t('URL')}
                hideLabel
                stacked
                placeholder={t('The URL to monitor')}
                flexibleControlStateSize
              />
              <FieldLabel disabled={!ENABLED_CONFIGURATION}>{t('Method')}</FieldLabel>
              <SelectField
                disabled={!ENABLED_CONFIGURATION}
                name="method"
                stacked
                placeholder={'GET'}
                options={HTTP_METHOD_OPTIONS.map(option => ({
                  value: option,
                  label: option,
                }))}
                flexibleControlStateSize
              />
              <FieldLabel disabled={!ENABLED_CONFIGURATION}>{t('Body')}</FieldLabel>
              <TextareaField
                name="body"
                label={t('Body')}
                rows={4}
                autosize
                hideLabel
                stacked
                placeholder='{"key": "value"}'
                flexibleControlStateSize
              />
              <FieldLabel disabled={!ENABLED_CONFIGURATION}>{t('Headers')}</FieldLabel>
              {Array.from(new Array(numHeaders)).map((_value, i) => (
                <HeaderRow key={i}>
                  <TextField
                    disabled={!ENABLED_CONFIGURATION}
                    name={`header_key_${i}`}
                    hideLabel
                    stacked
                    placeholder={t('X-Header-Name')}
                    flexibleControlStateSize
                  />
                  <TextField
                    disabled={!ENABLED_CONFIGURATION}
                    name={`header_value_${i}`}
                    hideLabel
                    stacked
                    placeholder={t('Value')}
                    flexibleControlStateSize
                  />
                  <Button
                    aria-label={t('Delete header')}
                    icon={<IconNot />}
                    onClick={() => setNumHeaders(currHeaders => currHeaders - 1)}
                    size="xs"
                    borderless
                  />
                </HeaderRow>
              ))}
              <AddHeaderButton
                icon={<IconAdd isCircled />}
                onClick={() => setNumHeaders(currHeaders => currHeaders + 1)}
              >
                {t('Add Header')}
              </AddHeaderButton>
            </ConfigurationGrid>
          </PanelBody>
        </Panel>
        <AlertListItem>{t('Establish ownership')}</AlertListItem>
        <FormRow>
          <TextField
            name="name"
            label={t('Uptime rule name')}
            hideLabel
            placeholder={t('Uptime rule name')}
            inline={false}
            flexibleControlStateSize
            stacked
          />
          <SentryMemberTeamSelectorField
            name="owner"
            label={t('Owner')}
            hideLabel
            menuPlacement="auto"
            inline={false}
            flexibleControlStateSize
            stacked
            style={{
              padding: 0,
              border: 'none',
            }}
          />
        </FormRow>
      </List>
    </UptimeForm>
  );
}

const UptimeForm = styled(Form)`
  ${FieldWrapper} {
    padding: 0;
  }
`;

const ConfigurationGrid = styled('div')`
  padding: ${space(2)};
  display: grid;
  gap: ${space(2)};
  grid-template-columns: max-content 1fr;
  align-items: center;
`;

const AddHeaderButton = styled(Button)`
  margin-left: ${space(2)};
  grid-column: 2;
  justify-self: start;
`;

const HeaderRow = styled('div')`
  display: grid;
  grid-column: 2 / -1;
  grid-template-columns: 1fr 1fr min-content;
  align-items: center;
`;

const AlertListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const FormRow = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  align-items: center;
  gap: ${space(2)};
`;
