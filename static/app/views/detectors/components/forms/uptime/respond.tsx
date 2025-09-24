import styled from '@emotion/styled';

import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import NumberField from 'sentry/components/forms/fields/numberField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import {
  UPTIME_DEFAULT_DOWNTIME_THRESHOLD,
  UPTIME_DEFAULT_RECOVERY_THRESHOLD,
} from 'sentry/views/detectors/components/forms/uptime/fields';

export function UptimeDetectorFormRespondSection() {
  return (
    <Container>
      <Section title={t('Respond')}>
        <ThresholdFieldsContainer>
          <NumberField
            name="downtimeThreshold"
            min={1}
            placeholder={t('Defaults to %s', UPTIME_DEFAULT_DOWNTIME_THRESHOLD)}
            help={({model}) => {
              const intervalSeconds = Number(model.getValue('intervalSeconds'));
              const threshold =
                Number(model.getValue('downtimeThreshold')) ||
                UPTIME_DEFAULT_DOWNTIME_THRESHOLD;
              const downDuration = intervalSeconds * threshold;

              return tct(
                'Issue created after [threshold] consecutive failures (after [downtime] of downtime).',
                {
                  threshold: <strong>{threshold}</strong>,
                  downtime: <strong>{getDuration(downDuration)}</strong>,
                }
              );
            }}
            label={t('Failure Tolerance')}
            defaultValue={UPTIME_DEFAULT_DOWNTIME_THRESHOLD}
            flexibleControlStateSize
          />
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
            label={t('Recovery Tolerance')}
            defaultValue={UPTIME_DEFAULT_RECOVERY_THRESHOLD}
            flexibleControlStateSize
          />
        </ThresholdFieldsContainer>
      </Section>
    </Container>
  );
}

const ThresholdFieldsContainer = styled('div')`
  display: grid;
  gap: ${space(2)};

  ${FieldWrapper} {
    padding-left: 0;
  }
`;
