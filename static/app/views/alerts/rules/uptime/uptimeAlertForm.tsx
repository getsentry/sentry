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
import useOrganization from 'sentry/utils/useOrganization';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';

interface Props {
  apiMethod: APIRequestMethod;
  apiUrl: string;
  onSubmitSuccess: FormProps['onSubmitSuccess'];
  project: Project;
  handleDelete?: () => void;
  rule?: UptimeRule;
}

const HTTP_METHOD_OPTIONS = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const HEADER_KEY_PREFIX = 'header_key_';
const HEADER_VALUE_PREFIX = 'header_value_';

function getFormDataFromRule(rule: UptimeRule) {
  const owner = rule.owner ? `${rule.owner.type}:${rule.owner.id}` : null;
  const {name, url, projectSlug, method, body, headers} = rule;

  // Map headers from API to form data
  const formHeaders = Object.entries(headers).reduce(
    (formHeaderMap, currentHeader, i) => {
      const [key, value] = currentHeader;
      formHeaderMap[`${HEADER_KEY_PREFIX}${i}`] = key;
      formHeaderMap[`${HEADER_VALUE_PREFIX}${i}`] = value;

      return formHeaderMap;
    },
    {}
  );
  return {owner, name, url, projectSlug, method, body, ...formHeaders};
}

function transformUptimeFormData(
  _data: Record<string, any>,
  model: FormModel
): Record<string, any> {
  const transformedData = {headers: {}};
  const jsonFields = model.fields.toJSON();

  // Map headers from form to API compatible object
  jsonFields.forEach(([key, value]) => {
    if (key.startsWith(HEADER_VALUE_PREFIX)) {
      return;
    }

    if (key.startsWith(HEADER_KEY_PREFIX)) {
      const headerKey = value?.toString();
      if (!headerKey) {
        return;
      }

      const headerIndex = key.substring(HEADER_KEY_PREFIX.length);
      const headerValueKey = `${HEADER_VALUE_PREFIX}${headerIndex}`;
      const headerValue = jsonFields.find(
        ([jsonKey, _jsonValue]) => jsonKey === headerValueKey
      )?.[1];

      transformedData.headers[headerKey] = headerValue;
    } else {
      transformedData[key] = value;
    }
  });

  return transformedData;
}

export function UptimeAlertForm({
  apiMethod,
  apiUrl,
  project,
  onSubmitSuccess,
  handleDelete,
  rule,
}: Props) {
  const organization = useOrganization();
  const enabledConfiguration = organization.features.includes('uptime-api-create-update');
  const initialData = rule
    ? getFormDataFromRule(rule)
    : {projectSlug: project.slug, method: 'GET'};

  // Constructs a base set of indices e.g. [0, 1, 2] recording which headers entries exist in the form
  const [headerIndices, setHeaderIndices] = useState<number[]>(
    rule ? [...Array(Object.keys(rule.headers).length).keys()] : [0]
  );
  const form = useRef(new FormModel({transformData: transformUptimeFormData}));

  return (
    <UptimeForm
      apiMethod={apiMethod}
      apiEndpoint={apiUrl}
      saveOnBlur={false}
      model={form.current}
      initialData={initialData}
      onSubmitSuccess={onSubmitSuccess}
      extraButton={
        rule && handleDelete ? (
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
            disabled={!enabledConfiguration}
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
            disabled={!enabledConfiguration}
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
              <FieldLabel disabled={!enabledConfiguration}>{t('URL')}</FieldLabel>
              <TextField
                disabled={!enabledConfiguration}
                name="url"
                label={t('URL')}
                hideLabel
                stacked
                placeholder={t('The URL to monitor')}
                flexibleControlStateSize
              />
              <FieldLabel disabled={!enabledConfiguration}>{t('Method')}</FieldLabel>
              <SelectField
                disabled={!enabledConfiguration}
                name="method"
                stacked
                placeholder={'GET'}
                options={HTTP_METHOD_OPTIONS.map(option => ({
                  value: option,
                  label: option,
                }))}
                flexibleControlStateSize
              />
              <FieldLabel disabled={!enabledConfiguration}>{t('Body')}</FieldLabel>
              <TextareaField
                name="body"
                label={t('Body')}
                rows={4}
                autosize
                hideLabel
                stacked
                placeholder='{"key": "value"}'
                flexibleControlStateSize
                disabled={!enabledConfiguration}
              />
              <FieldLabel disabled={!enabledConfiguration}>{t('Headers')}</FieldLabel>
              {headerIndices.map(headerId => (
                <HeaderRow key={headerId}>
                  <TextField
                    disabled={!enabledConfiguration}
                    name={`${HEADER_KEY_PREFIX}${headerId}`}
                    label={`${HEADER_KEY_PREFIX}${headerId}`}
                    hideLabel
                    stacked
                    placeholder={t('X-Header-Name')}
                    flexibleControlStateSize
                  />
                  <TextField
                    disabled={!enabledConfiguration}
                    name={`${HEADER_VALUE_PREFIX}${headerId}`}
                    label={`${HEADER_VALUE_PREFIX}${headerId}`}
                    hideLabel
                    stacked
                    placeholder={t('Value')}
                    flexibleControlStateSize
                  />
                  <Button
                    aria-label={t('Delete header')}
                    icon={<IconNot />}
                    onClick={() =>
                      setHeaderIndices(currHeaders =>
                        currHeaders.filter(currHeaderId => currHeaderId !== headerId)
                      )
                    }
                    size="xs"
                    borderless
                  />
                </HeaderRow>
              ))}
              <AddHeaderButton
                icon={<IconAdd isCircled />}
                onClick={() =>
                  setHeaderIndices(currHeaders => [
                    ...currHeaders,
                    Math.max(...currHeaders, -1) + 1,
                  ])
                }
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
