import {Fragment, useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import FeatureDisabled from 'sentry/components/acl/featureDisabled';
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

const THRESHOLD_MAP = ['off', 'low', 'medium', 'high'];

const autofixAutomatingTuningField: FieldObject = {
  name: 'autofixAutomationTuning',
  label: t('Autofix Automation Tuning'),
  help: t(
    "Choose how proactively Autofix attempts automatic fixes. 'Low' targets only issues deemed most likely to be successfully fixed."
  ),
  type: 'range',
  min: 0,
  max: THRESHOLD_MAP.length - 1,
  ticks: THRESHOLD_MAP.length - 1,
  tickValues: THRESHOLD_MAP.map((_, i) => i),
  formatLabel: (val: number | '') => {
    const numVal =
      typeof val === 'string' || val < 0 || val >= THRESHOLD_MAP.length ? 0 : val;
    const level = THRESHOLD_MAP[numVal];
    switch (level) {
      case 'off':
        return t('Off');
      case 'low':
        return t('Low');
      case 'medium':
        return t('Medium');
      case 'high':
        return t('High');
      default:
        return t('Off');
    }
  },
  getValue: (val: number): string => {
    return THRESHOLD_MAP[val]!;
  },
  saveOnBlur: true,
  showTickLabels: true,
  saveMessage: t('Autofix automation tuning updated'),
};

const seerFormGroups: JsonFormObject[] = [
  {
    title: t('General'),
    fields: [autofixAutomatingTuningField],
  },
];

function ProjectSeerGeneralForm({project}: ProjectSeerProps) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

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
    <Form
      saveOnBlur
      apiMethod="PUT"
      apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
      allowUndo
      initialData={{
        autofixAutomationTuning: THRESHOLD_MAP.indexOf(
          project.autofixAutomationTuning ?? 'off'
        ),
      }}
      onSubmitSuccess={handleSubmitSuccess}
    >
      <JsonForm forms={seerFormGroups} />
    </Form>
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
