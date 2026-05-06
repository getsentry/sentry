import {withFieldGroup} from '@sentry/scraps/form';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import {CRON_DEFAULT_RECOVERY_THRESHOLD} from 'sentry/views/detectors/components/forms/cron/fields';

export const CronResolveSection = withFieldGroup({
  defaultValues: {
    recoveryThreshold: CRON_DEFAULT_RECOVERY_THRESHOLD,
  },
  props: {} as {step?: number},
  render: ({group, step}) => (
    <Container>
      <FormSection step={step} title={t('Issue Resolution')}>
        <group.AppField name="recoveryThreshold">
          {field => (
            <field.Layout.Row
              label={t('Recovery Tolerance')}
              hintText={t(
                'Resolve the issue when this many consecutive healthy check-ins are processed.'
              )}
            >
              <field.Number
                value={field.state.value}
                onChange={field.handleChange}
                min={1}
                placeholder="1"
              />
            </field.Layout.Row>
          )}
        </group.AppField>
      </FormSection>
    </Container>
  ),
});
