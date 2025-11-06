import styled from '@emotion/styled';

import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import NumberField from 'sentry/components/forms/fields/numberField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t, tct} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {UPTIME_DEFAULT_RECOVERY_THRESHOLD} from 'sentry/views/detectors/components/forms/uptime/fields';

export function UptimeDetectorResolveSection() {
  return (
    <Container>
      <Section title={t('Resolve')}>
        <DetectFieldsContainer>
          <div>
            <NumberField
              name="recoveryThreshold"
              min={1}
              placeholder={t('Defaults to %s', UPTIME_DEFAULT_RECOVERY_THRESHOLD)}
              help={({model}) => {
                const intervalSeconds = Number(model.getValue('intervalSeconds'));
                const threshold =
                  Number(model.getValue('recoveryThreshold')) ||
                  UPTIME_DEFAULT_RECOVERY_THRESHOLD;
                const upDuration = intervalSeconds * threshold;

                return tct(
                  'Issue resolved after [threshold] consecutive successes (after [uptime] of recovered uptime).',
                  {
                    threshold: <strong>{threshold}</strong>,
                    uptime: <strong>{getDuration(upDuration)}</strong>,
                  }
                );
              }}
              label={t('Recovery Threshold')}
              flexibleControlStateSize
            />
          </div>
        </DetectFieldsContainer>
      </Section>
    </Container>
  );
}

const DetectFieldsContainer = styled('div')`
  ${FieldWrapper} {
    padding-left: 0;
  }
`;
