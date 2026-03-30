import styled from '@emotion/styled';

import {SelectField} from 'sentry/components/forms/fields/selectField';
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

export function EnvironmentField({
  includeAllEnvironments = true,
  ...props
}: EnvironmentFieldProps) {
  const {projects} = useProjects();
  const projectId = useFormField<string>('projectId')!;

  const environments = projects.find(p => p.id === projectId)?.environments ?? [];

  return (
    <StyledEnvironmentField
      choices={[
        ...(includeAllEnvironments ? [['', t('All Environments')] as const] : []),
        ...(environments?.map(environment => [environment, environment] as const) ?? []),
      ]}
      inline={false}
      flexibleControlStateSize
      stacked
      name="environment"
      label={t('Environment')}
      placeholder={t('Environment')}
      aria-label={t('Select Environment')}
      size="sm"
      {...props}
    />
  );
}

const StyledEnvironmentField = styled(SelectField)`
  flex-grow: 1;
  max-width: 260px;
  padding: 0;
`;
