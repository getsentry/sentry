import {withFieldGroup} from '@sentry/scraps/form';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';

import {
  DetectorProjectField,
  type DetectorProjectFieldProps,
} from './detectorProjectField';

export const DetectorProjectSection = withFieldGroup({
  defaultValues: {projectId: ''},
  props: {} as DetectorProjectFieldProps & {step?: number},
  render: ({group, step, ...props}) => (
    <Container>
      <FormSection
        step={step}
        title={t('Choose a Project')}
        description={t('This is where issues will be created.')}
      >
        <DetectorProjectField form={group} fields={{projectId: 'projectId'}} {...props} />
      </FormSection>
    </Container>
  ),
});
