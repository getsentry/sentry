import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {hasEveryAccess} from 'sentry/components/acl/access';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Alert} from 'sentry/components/core/alert';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import Link from 'sentry/components/links/link';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import {DataCategoryExact} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {getPricingDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {AutofixRepositories} from './autofixRepositories';

interface ProjectSeerProps {
  project: Project;
}

export const SEER_THRESHOLD_MAP = [
  'off',
  'super_low',
  'low',
  'medium',
  'high',
  'always',
] as const;

const SeerSelectLabel = styled('div')`
  margin-bottom: ${space(0.5)};
`;

export const autofixAutomatingTuningField = {
  name: 'autofixAutomationTuning',
  label: t('Automatically Analyze Incoming Issues'),
  help: props =>
    tct(
      "Set how frequently Seer can automatically run on new issues, based on how actionable it thinks the issue is. Seer will find a root cause and solution, but won't automatically open PRs.[break][break][link:You can configure automation for other projects too.][break][break]Each run is charged at the [ratelink:standard billing rate] for Seer's Issue Fix. See [spendlink:docs] on how to manage your Seer spend.",
      {
        break: <br />,
        link: <Link to={`/settings/${props.organization?.slug}/seer`} />,
        ratelink: <Link to={'https://docs.sentry.io/pricing/#seer-pricing'} />,
        spendlink: (
          <Link to={getPricingDocsLinkForEventType(DataCategoryExact.SEER_AUTOFIX)} />
        ),
      }
    ),
  type: 'choice',
  options: [
    {
      value: 'off',
      label: <SeerSelectLabel>{t('Off')}</SeerSelectLabel>,
      details: t('Seer will never analyze any issues without manually clicking Start.'),
    },
    {
      value: 'super_low',
      label: (
        <SeerSelectLabel>{t('Only Super Highly Actionable Issues')}</SeerSelectLabel>
      ),
      details: t(
        'Seer will automatically run on issues that it thinks have an actionability of "super high." This targets around 2% of issues, but may vary by project.'
      ),
    },
    {
      value: 'low',
      label: <SeerSelectLabel>{t('Highly Actionable and Above')}</SeerSelectLabel>,
      details: t(
        'Seer will automatically run on issues that it thinks have an actionability of "high" or above. This targets around 10% of issues, but may vary by project.'
      ),
    },
    {
      value: 'medium',
      label: <SeerSelectLabel>{t('Moderately Actionable and Above')}</SeerSelectLabel>,
      details: t(
        'Seer will automatically run on issues that it thinks have an actionability of "medium" or above. This targets around 30% of issues, but may vary by project.'
      ),
    },
    {
      value: 'high',
      label: <SeerSelectLabel>{t('Minimally Actionable and Above')}</SeerSelectLabel>,
      details: t(
        'Seer will automatically run on issues that it thinks have an actionability of "low" or above. This targets around 70% of issues, but may vary by project.'
      ),
    },
    {
      value: 'always',
      label: <SeerSelectLabel>{t('All Issues')}</SeerSelectLabel>,
      details: t('Seer will automatically run on all new issues.'),
    },
  ],
  saveOnBlur: true,
  saveMessage: t('Automatic Seer settings updated'),
} satisfies FieldObject;

const seerFormGroups: JsonFormObject[] = [
  {
    title: t('General'),
    fields: [autofixAutomatingTuningField],
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
          autofixAutomationTuning: project.autofixAutomationTuning ?? 'off',
        }}
        onSubmitSuccess={handleSubmitSuccess}
        additionalFieldProps={{organization}}
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
