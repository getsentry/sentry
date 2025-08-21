import {useEffect, useState} from 'react';

import {Input} from 'sentry/components/core/input';
import {Flex, Grid} from 'sentry/components/core/layout';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import {
  IncidentSetupStep,
  useIncidentSetupContext,
} from 'sentry/views/incidents/wizard/context';

export function TemplateStep() {
  const {template: templateContext, setStepContext} = useIncidentSetupContext();

  const [caseHandle, setCaseHandle] = useState(templateContext?.case_handle ?? '');
  const [severityHandle, setSeverityHandle] = useState(
    templateContext?.severity_handle ?? ''
  );
  const [leadTitle, setLeadTitle] = useState(templateContext?.lead_title ?? '');
  const [updateFrequency, setUpdateFrequency] = useState(
    templateContext?.update_frequency ?? '15'
  );

  useEffect(() => {
    if (!caseHandle || !severityHandle || !leadTitle || !updateFrequency) {
      return;
    }

    if (templateContext.complete) {
      return;
    }

    setStepContext(IncidentSetupStep.TEMPLATE, {
      complete: true,
      case_handle: caseHandle,
      severity_handle: severityHandle,
      lead_title: leadTitle,
      update_frequency: updateFrequency,
    });
  }, [
    caseHandle,
    severityHandle,
    leadTitle,
    updateFrequency,
    setStepContext,
    templateContext.complete,
  ]);

  return (
    <Flex direction="column" gap="2xl" maxWidth="650px">
      <Text>
        {t(
          'Everyone has preferences that best suit their workflow, set up the nit picks for your team.'
        )}
      </Text>
      <Flex direction="column" gap="xl">
        <Grid columns="1fr 1fr 2fr" gap="3xl">
          <Flex direction="column" gap="sm">
            <Flex direction="column" gap="xs">
              <Text bold size="sm">
                {t('Case Handle')}
              </Text>
              <Text size="sm">{t('Prefix for incidents')}</Text>
            </Flex>
            <Input
              placeholder={t('e.g. INC, OUT')}
              size="sm"
              maxLength={8}
              value={caseHandle}
              onChange={e => setCaseHandle(e.target.value)}
            />
          </Flex>
          <Flex direction="column" gap="sm">
            <Flex direction="column" gap="xs">
              <Text bold size="sm">
                {t('Severity Handle')}
              </Text>
              <Text size="sm">{t('Prefix for severity levels')}</Text>
            </Flex>
            <Input
              placeholder={t('e.g. P, SEV')}
              size="sm"
              maxLength={8}
              value={severityHandle}
              onChange={e => setSeverityHandle(e.target.value)}
            />
          </Flex>
          <Flex direction="column" gap="sm">
            <Flex direction="column" gap="xs">
              <Text bold size="sm">
                {t('Lead Title')}
              </Text>
              <Text size="sm">{t('Title for the person in charge')}</Text>
            </Flex>
            <Input
              placeholder={t('e.g. Commander')}
              size="sm"
              maxLength={32}
              value={leadTitle}
              onChange={e => setLeadTitle(e.target.value)}
            />
          </Flex>
        </Grid>

        <Flex direction="column" gap="sm">
          <Flex direction="column" gap="xs">
            <Text bold size="sm">
              {t('Update Frequency')}
            </Text>
            <Text size="sm">{t('How often should we be providing updates?')}</Text>
          </Flex>
          <SegmentedControl
            value={updateFrequency.toString()}
            onChange={setUpdateFrequency}
            size="xs"
            priority="primary"
          >
            <SegmentedControl.Item key="5">5 min</SegmentedControl.Item>
            <SegmentedControl.Item key="10">10 min</SegmentedControl.Item>
            <SegmentedControl.Item key="15">15 min</SegmentedControl.Item>
            <SegmentedControl.Item key="30">30 min</SegmentedControl.Item>
          </SegmentedControl>
        </Flex>
      </Flex>
    </Flex>
  );
}
