import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {autorun} from 'mobx';
import {Observer} from 'mobx-react';

import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldWrapper from 'sentry/components/forms/fieldGroup/fieldWrapper';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryMemberTeamSelectorField from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import Text from 'sentry/components/text';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getDuration from 'sentry/utils/duration/getDuration';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';

import {HTTPSnippet} from './httpSnippet';
import {UptimeHeadersField} from './uptimeHeadersField';

interface Props {
  organization: Organization;
  project: Project;
  handleDelete?: () => void;
  rule?: UptimeRule;
}

const HTTP_METHOD_OPTIONS = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

const MINUTE = 60;

const VALID_INTERVALS_SEC = [
  MINUTE * 1,
  MINUTE * 5,
  MINUTE * 10,
  MINUTE * 20,
  MINUTE * 30,
  MINUTE * 60,
];

function getFormDataFromRule(rule: UptimeRule) {
  return {
    name: rule.name,
    url: rule.url,
    projectSlug: rule.projectSlug,
    method: rule.method,
    body: rule.body,
    headers: rule.headers,
    intervalSeconds: rule.intervalSeconds,
    owner: rule.owner ? `${rule.owner.type}:${rule.owner.id}` : null,
  };
}

export function UptimeAlertForm({project, handleDelete, rule}: Props) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const {projects} = useProjects();

  const initialData = rule
    ? getFormDataFromRule(rule)
    : {projectSlug: project.slug, method: 'GET', headers: []};

  const [formModel] = useState(() => new FormModel());

  // XXX(epurkhiser): The forms API endpoint is derived from the selcted
  // project. We don't have an easy way to interpolate this into the <Form />
  // components `apiEndpoint` prop, so instead we setup a mobx observer on
  // value of the project slug and use that to update the endpoint of the form
  // model
  useEffect(
    () =>
      autorun(() => {
        const projectSlug = formModel.getValue('projectSlug');
        const apiEndpoint = rule
          ? `/projects/${organization.slug}/${projectSlug}/uptime/${rule.id}/`
          : `/projects/${organization.slug}/${projectSlug}/uptime/`;

        function onSubmitSuccess(response: any) {
          navigate(
            normalizeUrl(
              `/organizations/${organization.slug}/alerts/rules/uptime/${projectSlug}/${response.id}/details/`
            )
          );
        }
        formModel.setFormOptions({apiEndpoint, onSubmitSuccess});
      }),
    [formModel, navigate, organization.slug, rule]
  );

  return (
    <Form
      model={formModel}
      apiMethod={rule ? 'PUT' : 'POST'}
      saveOnBlur={false}
      initialData={initialData}
      submitLabel={rule ? t('Save Rule') : t('Create Rule')}
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
      <List symbol="colored-numeric">
        <AlertListItem>{t('Select a project and environment')}</AlertListItem>
        <ListItemSubText>
          {t(
            'The selected project and environment is where Uptime Issues will be created.'
          )}
        </ListItemSubText>
        <FormRow>
          <SentryProjectSelectorField
            disabled={rule !== undefined}
            disabledReason={t('Existing uptime rules cannot be moved between projects')}
            name="projectSlug"
            label={t('Project')}
            placeholder={t('Choose Project')}
            hideLabel
            projects={projects}
            valueIsSlug
            inline={false}
            flexibleControlStateSize
            stacked
            required
          />
        </FormRow>
        <AlertListItem>{t('Configure Request')}</AlertListItem>
        <ListItemSubText>
          {t('Configure the HTTP request made for uptime checks.')}
        </ListItemSubText>
        <Configuration>
          <ConfigurationPanel>
            <SelectField
              options={VALID_INTERVALS_SEC.map(value => ({
                value,
                label: t('Every %s', getDuration(value)),
              }))}
              name="intervalSeconds"
              label={t('Interval')}
              defaultValue={60}
              flexibleControlStateSize
              required
            />

            <TextField
              name="url"
              label={t('URL')}
              placeholder={t('The URL to monitor')}
              flexibleControlStateSize
              monospace
              required
            />
            <SelectField
              name="method"
              label={t('Method')}
              defaultValue="GET"
              options={HTTP_METHOD_OPTIONS.map(option => ({
                value: option,
                label: option,
              }))}
              flexibleControlStateSize
              required
            />
            <UptimeHeadersField
              name="headers"
              label={t('Headers')}
              flexibleControlStateSize
            />
            <TextareaField
              name="body"
              label={t('Body')}
              visible={({model}) => !['GET', 'HEAD'].includes(model.getValue('method'))}
              rows={4}
              maxRows={15}
              autosize
              monospace
              placeholder='{"key": "value"}'
              flexibleControlStateSize
            />
          </ConfigurationPanel>
          <Observer>
            {() => (
              <HTTPSnippet
                url={formModel.getValue('url')}
                method={formModel.getValue('method')}
                headers={formModel.getValue('headers')}
                body={formModel.getValue('body')}
              />
            )}
          </Observer>
        </Configuration>
        <AlertListItem>{t('Establish ownership')}</AlertListItem>
        <ListItemSubText>
          {t(
            'Choose a team or member as the rule owner. Issues created will be automatically assigned to the owner.'
          )}
        </ListItemSubText>
        <FormRow>
          <TextField
            name="name"
            label={t('Uptime rule name')}
            hideLabel
            placeholder={t('Uptime rule name')}
            inline={false}
            flexibleControlStateSize
            stacked
            required
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
    </Form>
  );
}

const AlertListItem = styled(ListItem)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.3;
`;

const ListItemSubText = styled(Text)`
  padding-left: ${space(4)};
  color: ${p => p.theme.subText};
`;

const FormRow = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  align-items: center;
  gap: ${space(2)};
  margin-top: ${space(1)};
  margin-bottom: ${space(4)};
  margin-left: ${space(4)};

  ${FieldWrapper} {
    padding: 0;
  }
`;

const Configuration = styled('div')`
  margin-top: ${space(1)};
  margin-bottom: ${space(4)};
  margin-left: ${space(4)};
`;

const ConfigurationPanel = styled(Panel)`
  display: grid;
  gap: 0 ${space(2)};
  grid-template-columns: max-content 1fr;
  align-items: center;

  ${FieldWrapper} {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;

    label {
      width: auto;
    }
  }
`;
