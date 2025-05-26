import {Fragment, useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {hasEveryAccess} from 'sentry/components/acl/access';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {AutofixRepositories} from './autofixRepositories';

interface ProjectSeerProps {
  project: Project;
}

export const SEER_THRESHOLD_MAP = ['off', 'low', 'medium', 'high', 'always'] as const;

export function formatSeerValue(value: string | undefined) {
  switch (value) {
    case 'off':
      return t('Off');
    case 'low':
      return t('Low');
    case 'medium':
      return t('Medium');
    case 'high':
      return t('High');
    case 'always':
      return t('Always');
    default:
      return null;
  }
}

export const autofixAutomatingTuningField = {
  name: 'autofixAutomationTuning',
  label: t('Automatically Fix Issues with Seer'),
  help: t(
    "Set how frequently Seer runs root cause analysis and fixes on issues. A 'Low' setting means Seer runs only on the most actionable issues, while a 'High' setting enables Seer to be more eager."
  ),
  type: 'range',
  min: 0,
  max: SEER_THRESHOLD_MAP.length - 1,
  ticks: SEER_THRESHOLD_MAP.length - 1,
  tickValues: SEER_THRESHOLD_MAP.map((_, i) => i),
  formatLabel: (val: number | '') => {
    const numVal =
      typeof val === 'string' || val < 0 || val >= SEER_THRESHOLD_MAP.length ? 0 : val;
    const level = SEER_THRESHOLD_MAP[numVal];
    return formatSeerValue(level);
  },
  getValue: (val: number): string => {
    return SEER_THRESHOLD_MAP[val]!;
  },
  saveOnBlur: true,
  showTickLabels: true,
  saveMessage: t('Automatic Seer settings updated'),
} satisfies FieldObject;

const configureAllProjectsField = {
  name: 'configureAutomationForAllProjects',
  type: 'custom' as const,
  Component: () => {
    const organization = useOrganization();
    return (
      <FieldGroup
        label={t('Configure Automation for Other Projects')}
        help={t(
          'Allow Seer to automatically fix issues for other projects in addition to this one.'
        )}
        alignRight
      >
        <div style={{width: 'auto'}}>
          <LinkButton
            to={`/settings/${organization.slug}/seer`}
            priority="link"
            size="sm"
          >
            {t('Go to Seer Automation Settings')}
          </LinkButton>
        </div>
      </FieldGroup>
    );
  },
};

const configureSourceIntegration = {
  name: 'configureSourceIntegration',
  type: 'custom' as const,
  Component: () => {
    const organization = useOrganization();
    return (
      <FieldGroup
        label={t('Configure GitHub Integration')}
        help={t(
          'The GitHub integration allows Seer to analyze your code to find more accurate root causes and solutions to your issues. Support for other source providers is coming soon.'
        )}
        alignRight
      >
        <div style={{width: 'auto'}}>
          <LinkButton
            to={`/settings/${organization.slug}/integrations/github/`}
            priority="link"
            size="sm"
          >
            {t('Go to GitHub Integration Settings')}
          </LinkButton>
        </div>
      </FieldGroup>
    );
  },
};

const seerFormGroups: JsonFormObject[] = [
  {
    title: t('General'),
    fields: [
      autofixAutomatingTuningField,
      configureAllProjectsField,
      configureSourceIntegration,
    ],
  },
];

function ProjectSeerGeneralForm({project}: ProjectSeerProps) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const canWriteProject = hasEveryAccess(['project:write'], {organization, project});

  const handleSubmitSuccess = useCallback(
    (resp: Project) => {
      const projectId = project.slug;

      const projectSettingsQueryKey: ApiQueryKey = [
        `/projects/${organization.slug}/${projectId}/`,
      ];
      setApiQueryData(queryClient, projectSettingsQueryKey, resp);
      ProjectsStore.onUpdateSuccess(resp);
    },
    [project.slug, queryClient, organization.slug]
  );

  return (
    <Fragment>
      <Form
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
        allowUndo
        initialData={{
          autofixAutomationTuning: SEER_THRESHOLD_MAP.indexOf(
            project.autofixAutomationTuning ?? 'off'
          ),
        }}
        onSubmitSuccess={handleSubmitSuccess}
      >
        <JsonForm
          forms={seerFormGroups}
          disabled={!canWriteProject}
          renderHeader={() =>
            !canWriteProject && (
              <Alert type="warning" system>
                {t(
                  'These settings can only be edited by users with the organization-level owner, manager, or team-level admin role.'
                )}
              </Alert>
            )
          }
        />
      </Form>
    </Fragment>
  );
}

function ProjectSeer({project}: ProjectSeerProps) {
  const organization = useOrganization();
  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Project Seer Settings')}
        projectSlug={project.slug}
      />
      <SettingsPageHeader title={t('Seer')} />
      {organization.features.includes('trigger-autofix-on-issue-summary') && (
        <ProjectSeerGeneralForm project={project} />
      )}
      <AutofixRepositories project={project} />
    </Fragment>
  );
}

export default function ProjectSeerContainer({project}: ProjectSeerProps) {
  const organization = useOrganization();

  if (!organization.features.includes('autofix-seer-preferences')) {
    return (
      <FeatureDisabled
        features={['autofix-seer-preferences']}
        hideHelpToggle
        message={t('Autofix is not enabled for this organization.')}
        featureName={t('Autofix')}
      />
    );
  }

  return <ProjectSeer project={project} />;
}
