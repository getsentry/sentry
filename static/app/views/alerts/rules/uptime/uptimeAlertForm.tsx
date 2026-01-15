import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {IReactionDisposer} from 'mobx';
import {autorun} from 'mobx';
import {Observer} from 'mobx-react-lite';

import Confirm from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import HiddenField from 'sentry/components/forms/fields/hiddenField';
import NumberField from 'sentry/components/forms/fields/numberField';
import RangeField from 'sentry/components/forms/fields/rangeField';
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
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDuration from 'sentry/utils/duration/getDuration';
import {useQueryClient} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';

import {UptimeAssertionsField} from './assertions/field';
import {HTTPSnippet} from './httpSnippet';
import {UptimeHeadersField} from './uptimeHeadersField';

interface Props {
  handleDelete?: () => void;
  rule?: UptimeRule;
}

const HTTP_METHOD_OPTIONS = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

const HTTP_METHODS_NO_BODY = ['GET', 'HEAD', 'OPTIONS'];

const MINUTE = 60;

const DEFAULT_DOWNTIME_THRESHOLD = 3;
const DEFAULT_RECOVERY_THRESHOLD = 1;

const VALID_INTERVALS_SEC = [
  MINUTE * 1,
  MINUTE * 5,
  MINUTE * 10,
  MINUTE * 20,
  MINUTE * 30,
  MINUTE * 60,
];

function methodHasBody(model: FormModel) {
  return !HTTP_METHODS_NO_BODY.includes(model.getValue('method'));
}

function getFormDataFromRule(rule: UptimeRule) {
  return {
    name: rule.name,
    environment: rule.environment,
    url: rule.url,
    projectSlug: rule.projectSlug,
    method: rule.method,
    body: rule.body,
    headers: rule.headers,
    intervalSeconds: rule.intervalSeconds,
    timeoutMs: rule.timeoutMs,
    traceSampling: rule.traceSampling,
    owner: rule.owner ? `${rule.owner.type}:${rule.owner.id}` : null,
    recoveryThreshold: rule.recoveryThreshold,
    downtimeThreshold: rule.downtimeThreshold,
    assertion: rule.assertion,
  };
}

export function UptimeAlertForm({handleDelete, rule}: Props) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const project =
    projects.find(p => selection.projects[0]?.toString() === p.id) ??
    (projects.length === 1 ? projects[0] : null);

  const initialData = rule
    ? getFormDataFromRule(rule)
    : {projectSlug: project?.slug, method: 'GET', headers: []};

  const [formModel] = useState(() => new FormModel());

  const [knownEnvironments, setEnvironments] = useState<string[]>([]);
  const [newEnvironment, setNewEnvironment] = useState<string | undefined>(undefined);
  const environments = [newEnvironment, ...knownEnvironments].filter(Boolean);

  // XXX(epurkhiser): The forms API endpoint is derived from the selcted
  // project. We don't have an easy way to interpolate this into the <Form />
  // components `apiEndpoint` prop, so instead we setup a mobx observer on
  // value of the project slug and use that to update the endpoint of the form
  // model
  useEffect(
    () =>
      autorun(() => {
        const projectSlug = formModel.getValue<string>('projectSlug');
        const selectedProject = projects.find(p => p.slug === projectSlug);
        const apiEndpoint = rule
          ? `/projects/${organization.slug}/${projectSlug}/uptime/${rule.id}/`
          : `/projects/${organization.slug}/${projectSlug}/uptime/`;

        function onSubmitSuccess(response: any) {
          // Clear the cached uptime rule so subsequent edits load fresh data
          const ruleId = response?.id ?? rule?.id;
          if (ruleId) {
            queryClient.invalidateQueries({
              queryKey: [
                `/projects/${organization.slug}/${projectSlug}/uptime/${ruleId}/`,
              ],
              exact: true,
            });
          }

          if (!rule) {
            trackAnalytics('uptime_monitor.created', {
              organization,
              uptime_mode: response.mode,
            });
          }

          navigate(
            makeAlertsPathname({
              path: `/rules/uptime/${projectSlug}/${response.id}/details/`,
              organization,
            })
          );
        }
        formModel.setFormOptions({apiEndpoint, onSubmitSuccess});

        if (selectedProject) {
          setEnvironments(selectedProject.environments);
        }
      }),
    [formModel, navigate, organization, projects, rule, queryClient]
  );

  // When mutating the name field manually, we'll disable automatic name
  // generation from the URL
  const [hasCustomName, setHasCustomName] = useState(false);
  const disposeNameSetter = useRef<IReactionDisposer>(null);
  const hasRule = !!rule;

  // Suggest rule name from URL
  useEffect(() => {
    if (hasRule || hasCustomName) {
      return () => {};
    }
    disposeNameSetter.current = autorun(() => {
      const url = formModel.getValue('url');

      if (typeof url !== 'string') {
        return;
      }

      try {
        const parsedUrl = new URL(url);
        const path = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname;
        const urlName = `${parsedUrl.hostname}${path}`.replace(/\/$/, '');

        formModel.setValue('name', t('Uptime check for %s', urlName));
      } catch {
        // Nothing to do if we failed to parse the URL
      }
    });

    return disposeNameSetter.current;
  }, [formModel, hasRule, hasCustomName]);

  return (
    <Form
      model={formModel}
      apiMethod={rule ? 'PUT' : 'POST'}
      saveOnBlur={false}
      initialData={initialData}
      submitLabel={rule ? t('Save Rule') : t('Create Rule')}
      onPreSubmit={() => {
        if (!methodHasBody(formModel)) {
          formModel.setValue('body', null);
        }
      }}
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
            projects={projects}
            valueIsSlug
            inline={false}
            flexibleControlStateSize
            stacked
            required
          />
          <SelectField
            name="environment"
            label={t('Environment')}
            placeholder={t('Select an environment')}
            noOptionsMessage={() => t('Start typing to create an environment')}
            onCreateOption={(env: any) => {
              setNewEnvironment(env);
              formModel.setValue('environment', env);
            }}
            creatable
            options={environments.map(e => ({value: e, label: e}))}
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
            <SelectField
              options={VALID_INTERVALS_SEC.map(value => ({
                value,
                label: t('Every %s', getDuration(value)),
              }))}
              name="intervalSeconds"
              label={t('Interval')}
              defaultValue={60}
              flexibleControlStateSize
              showHelpInTooltip={{isHoverable: true}}
              help={({model}) =>
                tct(
                  'The amount of time between each uptime check request. Selecting a period of [interval] means it will take at least [expectedFailureInterval] until you are notified of a failure. [link:Learn more].',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/#uptime-check-failures" />
                    ),
                    interval: (
                      <strong>{getDuration(model.getValue('intervalSeconds'))}</strong>
                    ),
                    expectedFailureInterval: (
                      <strong>
                        {getDuration(Number(model.getValue('intervalSeconds')) * 3)}
                      </strong>
                    ),
                  }
                )
              }
              required
            />
            <RangeField
              name="timeoutMs"
              label={t('Timeout')}
              min={1000}
              max={60_000}
              step={250}
              tickValues={[1_000, 10_000, 20_000, 30_000, 40_000, 50_000, 60_000]}
              defaultValue={5_000}
              showTickLabels
              formatLabel={value => getDuration((value || 0) / 1000, 2, true)}
              flexibleControlStateSize
              required
            />
            <UptimeHeadersField
              name="headers"
              label={t('Headers')}
              showHelpInTooltip={{isHoverable: true}}
              help={t(
                'Avoid adding sensitive credentials to headers as they are stored in plain text.'
              )}
              flexibleControlStateSize
            />
            <TextareaField
              name="body"
              label={t('Body')}
              visible={({model}: any) => methodHasBody(model)}
              rows={4}
              maxRows={15}
              autosize
              monospace
              placeholder='{"key": "value"}'
              flexibleControlStateSize
            />
            <BooleanField
              name="traceSampling"
              label={t('Allow Sampling')}
              showHelpInTooltip={{isHoverable: true}}
              help={tct(
                'Defer the sampling decision to a Sentry SDK configured in your application. Disable to prevent all span sampling. [link:Learn more].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/uptime-tracing/" />
                  ),
                }
              )}
              flexibleControlStateSize
            />
          </ConfigurationPanel>
          <Alert.Container>
            <Alert variant="muted">
              {tct(
                'By enabling uptime monitoring, you acknowledge that uptime check data may be stored outside your selected data region. [link:Learn more].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/organization/data-storage-location/#data-stored-in-us" />
                  ),
                }
              )}
            </Alert>
          </Alert.Container>
          <Observer>
            {() => (
              <HTTPSnippet
                url={formModel.getValue('url')}
                method={formModel.getValue('method')}
                headers={formModel.getValue('headers')}
                body={methodHasBody(formModel) ? formModel.getValue('body') : null}
                traceSampling={formModel.getValue('traceSampling')}
              />
            )}
          </Observer>
        </Configuration>
        {organization.features.includes('uptime-runtime-assertions') && (
          <React.Fragment>
            <AlertListItem>{t('Verification')}</AlertListItem>
            <ListItemSubText>
              {t(
                'Define conditions that must be met for the check to be considered successful.'
              )}
            </ListItemSubText>
            <Configuration>
              <ConfigurationPanel>
                <UptimeAssertionsField
                  name="assertion"
                  label={t('Assertions')}
                  flexibleControlStateSize
                />
              </ConfigurationPanel>
            </Configuration>
          </React.Fragment>
        )}
        <AlertListItem>{t('Set thresholds')}</AlertListItem>
        <ListItemSubText>
          {t('Configure when an issue is created or resolved.')}
        </ListItemSubText>
        <Configuration>
          <ConfigurationPanel>
            <NumberField
              name="downtimeThreshold"
              min={1}
              placeholder={t('Defaults to 3')}
              help={({model}) => {
                const intervalSeconds = Number(model.getValue('intervalSeconds'));
                const threshold =
                  Number(model.getValue('downtimeThreshold')) ||
                  DEFAULT_DOWNTIME_THRESHOLD;
                const downDuration = intervalSeconds * threshold;
                return tct(
                  'Issue created after [threshold] consecutive failures (after [downtime] of downtime).',
                  {
                    threshold: <strong>{threshold}</strong>,
                    downtime: <strong>{getDuration(downDuration)}</strong>,
                  }
                );
              }}
              label={t('Failure Tolerance')}
              flexibleControlStateSize
            />
            <NumberField
              name="recoveryThreshold"
              min={1}
              placeholder={t('Defaults to 1')}
              help={({model}) => {
                const intervalSeconds = Number(model.getValue('intervalSeconds'));
                const threshold =
                  Number(model.getValue('recoveryThreshold')) ||
                  DEFAULT_RECOVERY_THRESHOLD;
                const upDuration = intervalSeconds * threshold;
                return tct(
                  'Issue resolved after [threshold] consecutive successes (after [uptime] of recovered uptime).',
                  {
                    threshold: <strong>{threshold}</strong>,
                    uptime: <strong>{getDuration(upDuration)}</strong>,
                  }
                );
              }}
              label={t('Recovery Tolerance')}
              flexibleControlStateSize
            />
          </ConfigurationPanel>
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
            placeholder={t('Uptime rule name')}
            onChange={() => {
              // Immediately dispose of the autorun name setter, since it won't
              // receive the hasCustomName state before the autorun is ran
              // again after this change (overriding whatever change the user
              // just made)
              disposeNameSetter.current?.();
              setHasCustomName(true);
            }}
            inline={false}
            flexibleControlStateSize
            stacked
            required
          />
          <SentryMemberTeamSelectorField
            name="owner"
            label={t('Owner')}
            inline={false}
            flexibleControlStateSize
            stacked
            style={{
              padding: 0,
              border: 'none',
            }}
          />
          <HiddenField name="timeoutMs" defaultValue={10000} />
        </FormRow>
      </List>
    </Form>
  );
}

const AlertListItem = styled(ListItem)`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: 1.3;
`;

const ListItemSubText = styled(Text)`
  padding-left: ${space(4)};
  color: ${p => p.theme.tokens.content.secondary};
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
  grid-template-columns: fit-content(325px) 1fr;
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
