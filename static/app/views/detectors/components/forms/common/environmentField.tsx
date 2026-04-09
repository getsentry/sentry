import {useContext, useState} from 'react';
import styled from '@emotion/styled';

import {SelectField} from 'sentry/components/forms/fields/selectField';
import {FormContext} from 'sentry/components/forms/formContext';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import {useProjects} from 'sentry/utils/useProjects';

export interface EnvironmentConfig {
  fieldProps?: Partial<React.ComponentProps<typeof SelectField>>;
  includeAllEnvironments?: boolean;
}

type EnvironmentFieldProps = Partial<React.ComponentProps<typeof SelectField>> & {
  includeAllEnvironments?: boolean;
};

const ENV_FIELD_NAME = 'environment';

export function EnvironmentField({
  includeAllEnvironments = true,
  ...props
}: EnvironmentFieldProps) {
  const {projects} = useProjects();
  const projectId = useFormField<string>('projectId')!;
  const formContext = useContext(FormContext);

  const [newEnvironment, setNewEnvironment] = useState<string | undefined>(undefined);

  const environments = projects.find(p => p.id === projectId)?.environments ?? [];

  const choices = [
    ...(includeAllEnvironments ? [['', t('All Environments')] as const] : []),
    ...(newEnvironment ? [[newEnvironment, newEnvironment] as const] : []),
    ...(environments?.map(environment => [environment, environment] as const) ?? []),
  ];

  return (
    <StyledEnvironmentField
      choices={choices}
      inline={false}
      flexibleControlStateSize
      stacked
      name={ENV_FIELD_NAME}
      label={t('Environment')}
      placeholder={t('Environment')}
      aria-label={t('Select Environment')}
      size="sm"
      creatable
      onCreateOption={env => {
        setNewEnvironment(env);
        formContext.form?.setValue(ENV_FIELD_NAME, env);
      }}
      {...props}
    />
  );
}

const StyledEnvironmentField = styled(SelectField)`
  flex-grow: 1;
  max-width: 260px;
  padding: 0;
`;
