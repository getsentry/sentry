import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import RangeField from 'sentry/components/forms/fields/rangeField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import type FormModel from 'sentry/components/forms/model';
import ExternalLink from 'sentry/components/links/externalLink';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t, tct} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {UptimeHeadersField} from 'sentry/views/detectors/components/forms/uptime/detect/uptimeHeadersField';

const HTTP_METHOD_OPTIONS = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const HTTP_METHODS_NO_BODY = ['GET', 'HEAD', 'OPTIONS'];
const MINUTE = 60;
const VALID_INTERVALS_SEC = [
  MINUTE * 1,
  MINUTE * 5,
  MINUTE * 10,
  MINUTE * 20,
  MINUTE * 30,
  MINUTE * 60,
];

function methodHasBody(model: FormModel) {
  return !HTTP_METHODS_NO_BODY.includes(model.getValue('method'));
}

export function UptimeDetectorFormDetectSection() {
  return (
    <Container>
      <Section title={t('Detect')}>
        <DetectFieldsContainer>
          <div>
            <SelectField
              options={VALID_INTERVALS_SEC.map(value => ({
                value,
                label: t('Every %s', getDuration(value)),
              }))}
              name="intervalSeconds"
              label={t('Interval')}
              defaultValue={60}
              flexibleControlStateSize
              showHelpInTooltip={{isHoverable: true}}
              help={({model}) =>
                tct(
                  'The amount of time between each uptime check request. Selecting a period of [interval] means it will take at least [expectedFailureInterval] until you are notified of a failure. [link:Learn more].',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/#uptime-check-failures" />
                    ),
                    interval: (
                      <strong>{getDuration(model.getValue('intervalSeconds'))}</strong>
                    ),
                    expectedFailureInterval: (
                      <strong>
                        {getDuration(Number(model.getValue('intervalSeconds')) * 3)}
                      </strong>
                    ),
                  }
                )
              }
              required
            />
            <RangeField
              name="timeoutMs"
              label={t('Timeout')}
              min={1000}
              max={60_000}
              step={250}
              tickValues={[1_000, 10_000, 20_000, 30_000, 40_000, 50_000, 60_000]}
              defaultValue={5_000}
              showTickLabels
              formatLabel={value => getDuration((value || 0) / 1000, 2, true)}
              flexibleControlStateSize
              required
            />
            <TextField
              name="url"
              label={t('URL')}
              placeholder={t('The URL to monitor')}
              flexibleControlStateSize
              monospace
              required
            />
            <SelectField
              name="method"
              label={t('Method')}
              defaultValue="GET"
              options={HTTP_METHOD_OPTIONS.map(option => ({
                value: option,
                label: option,
              }))}
              flexibleControlStateSize
              required
            />
            <UptimeHeadersField
              name="headers"
              label={t('Headers')}
              flexibleControlStateSize
            />
            <TextareaField
              name="body"
              label={t('Body')}
              visible={({model}: any) => methodHasBody(model)}
              rows={4}
              maxRows={15}
              autosize
              monospace
              placeholder='{"key": "value"}'
              flexibleControlStateSize
            />
            <BooleanField
              name="traceSampling"
              label={t('Allow Sampling')}
              showHelpInTooltip={{isHoverable: true}}
              help={tct(
                'Defer the sampling decision to a Sentry SDK configured in your application. Disable to prevent all span sampling. [link:Learn more].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/uptime-tracing/" />
                  ),
                }
              )}
              flexibleControlStateSize
            />
          </div>
          <Alert type="muted" showIcon>
            {tct(
              'By enabling uptime monitoring, you acknowledge that uptime check data may be stored outside your selected data region. [link:Learn more].',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/organization/data-storage-location/#data-stored-in-us" />
                ),
              }
            )}
          </Alert>
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
