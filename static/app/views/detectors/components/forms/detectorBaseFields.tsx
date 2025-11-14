import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import EditableText from 'sentry/components/editableText';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import FormField from 'sentry/components/forms/formField';
import * as Layout from 'sentry/components/layouts/thirds';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';

interface JsonSchema {
  properties?: Record<string, any>;
  required?: string[];
}

function useDetectorSchemaFields() {
  const {detectorType} = useDetectorFormContext();
  const organization = useOrganization();
  const queryKey: ApiQueryKey = [`/organizations/${organization.slug}/detector-types/`];

  const {data: detectorTypes} = useApiQuery<Record<string, JsonSchema>>(queryKey, {
    staleTime: 60000,
  });

  return useMemo(() => {
    if (!detectorTypes) {
      return {supportsEnvironment: true, supportsName: true};
    }
    const schema = detectorTypes[detectorType];
    if (!schema) {
      return {supportsEnvironment: true, supportsName: true};
    }
    const properties = schema.properties || {};
    const requiredFields = new Set(schema.required || []);

    return {
      supportsEnvironment:
        requiredFields.has('environment') || 'environment' in properties,
      supportsName: requiredFields.has('name') || 'name' in properties,
    };
  }, [detectorTypes, detectorType]);
}

export function DetectorBaseFields() {
  const {setHasSetDetectorName} = useDetectorFormContext();
  const {supportsEnvironment, supportsName} = useDetectorSchemaFields();

  return (
    <Flex gap="md" direction="column">
      <Layout.Title>
        <FormField name="name" inline={false} flexibleControlStateSize stacked>
          {({onChange, value}) => (
            <EditableText
              isDisabled={!supportsName}
              value={value || ''}
              onChange={newValue => {
                onChange(newValue, {
                  target: {
                    value: newValue,
                  },
                });
                setHasSetDetectorName(true);
              }}
              errorMessage={t('Please set a title')}
              placeholder={t('New Monitor')}
              aria-label={t('Monitor Name')}
            />
          )}
        </FormField>
      </Layout.Title>
      <Flex gap="md">
        <ProjectField />
        {supportsEnvironment && <EnvironmentField />}
      </Flex>
    </Flex>
  );
}

function ProjectField() {
  const {projects, fetching} = useProjects();
  const {project, detectorType} = useDetectorFormContext();
  const canEditDetector = useCanEditDetector({projectId: project.id, detectorType});

  return (
    <StyledProjectField
      inline={false}
      flexibleControlStateSize
      stacked
      projects={projects}
      groupProjects={p => (p.isMember ? 'member' : 'all')}
      groups={[
        {key: 'member', label: t('My Projects')},
        {key: 'all', label: t('All Projects')},
      ]}
      name="projectId"
      placeholder={t('Project')}
      aria-label={t('Select Project')}
      disabled={fetching}
      size="sm"
      validate={() => {
        if (!canEditDetector) {
          return [
            [
              'projectId',
              t('You do not have permission to create or edit monitors in this project'),
            ],
          ];
        }
        return [];
      }}
    />
  );
}

function EnvironmentField() {
  const {projects} = useProjects();
  const projectId = useFormField<string>('projectId')!;

  const environments = projects.find(p => p.id === projectId)?.environments ?? [];

  return (
    <StyledEnvironmentField
      choices={[
        ['', t('All Environments')],
        ...(environments?.map(environment => [environment, environment]) ?? []),
      ]}
      inline={false}
      flexibleControlStateSize
      stacked
      name="environment"
      placeholder={t('Environment')}
      aria-label={t('Select Environment')}
      size="sm"
    />
  );
}

const StyledProjectField = styled(SentryProjectSelectorField)`
  flex-grow: 1;
  max-width: 260px;
  padding: 0;
`;

const StyledEnvironmentField = styled(SelectField)`
  flex-grow: 1;
  max-width: 260px;
  padding: 0;
`;
