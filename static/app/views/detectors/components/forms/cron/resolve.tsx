import styled from '@emotion/styled';

import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import NumberField from 'sentry/components/forms/fields/numberField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {CRON_DEFAULT_RECOVERY_THRESHOLD} from 'sentry/views/detectors/components/forms/cron/fields';

export function CronDetectorFormResolveSection() {
  return (
    <Container>
      <Section title={t('Resolve')}>
        <RemoveFieldPadding>
          <NumberField
            name="recoveryThreshold"
            min={1}
            placeholder="1"
            help={t(
              'Resolve the issue when this many consecutive healthy check-ins are processed.'
            )}
            label={t('Recovery Tolerance')}
            defaultValue={CRON_DEFAULT_RECOVERY_THRESHOLD}
          />
        </RemoveFieldPadding>
      </Section>
    </Container>
  );
}

const RemoveFieldPadding = styled('div')`
  ${FieldWrapper} {
    padding-left: 0;
  }
`;
