import {Fragment} from 'react';

import {InlineCode} from '@sentry/scraps/code';
import {useStore, withFieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {PriorityLevel} from 'sentry/types/group';
import type {
  PreprodMeasurement,
  PreprodThresholdType,
} from 'sentry/types/workflowEngine/detectors';
import {DetectorSegmentedRadio} from 'sentry/views/detectors/components/forms/common/detectorSegmentedRadio';
import {useDetectorProject} from 'sentry/views/detectors/components/forms/common/useDetectorProject';
import {PriorityDot} from 'sentry/views/detectors/components/priorityDot';
import {
  getMetricLabelForPlatform,
  guessPlatformForProject,
  isDiffThreshold,
  MEASUREMENT_OPTIONS,
  METRIC_OPTIONS,
} from 'sentry/views/settings/project/preprod/types';

export const MobileBuildDetectSection = withFieldGroup({
  defaultValues: {
    projectId: '',
    measurement: 'install_size' as PreprodMeasurement,
    thresholdType: 'absolute' as PreprodThresholdType,
    highThreshold: '',
    lowThreshold: '',
  },
  render: function MobileBuildDetectSection({group}) {
    const projectId = useStore(group.store, state => state.values.projectId);
    const thresholdType = useStore(group.store, state => state.values.thresholdType);
    const project = useDetectorProject(projectId);
    const platform = guessPlatformForProject(project);
    const isPercentage = thresholdType === 'relative_diff';
    return (
      <Fragment>
        <Container>
          <FormSection step={2} title={t('Choose Your Measurement')}>
            <group.AppField name="measurement">
              {field => (
                <field.Base<HTMLInputElement>>
                  {props => (
                    <DetectorSegmentedRadio
                      {...props}
                      aria-label={t('Measurement')}
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={METRIC_OPTIONS.map(({value}) => ({
                        value,
                        label: getMetricLabelForPlatform(value, platform),
                      }))}
                    />
                  )}
                </field.Base>
              )}
            </group.AppField>
          </FormSection>
        </Container>
        <Container>
          <FormSection step={3} title={t('Issue Detection')}>
            <Stack gap="lg">
              <group.AppField name="thresholdType">
                {field => (
                  <field.Base<HTMLInputElement>>
                    {props => (
                      <DetectorSegmentedRadio
                        {...props}
                        aria-label={t('Threshold type')}
                        value={field.state.value}
                        onChange={field.handleChange}
                        options={MEASUREMENT_OPTIONS}
                      />
                    )}
                  </field.Base>
                )}
              </group.AppField>
              {isDiffThreshold(thresholdType) && (
                <Flex align="center" gap="sm">
                  <IconInfo size="xs" />
                  <Text variant="muted" size="sm">
                    {tct(
                      "Compares against the previous build matching this monitor's filters, [platform], [packageName], and [buildConfiguration].",
                      {
                        platform: <InlineCode>platform</InlineCode>,
                        packageName: <InlineCode>package_name</InlineCode>,
                        buildConfiguration: <InlineCode>build_configuration</InlineCode>,
                      }
                    )}
                  </Text>
                </Flex>
              )}
              <Stack gap="xs">
                <Text bold>{t('Define threshold & set priority')}</Text>
                <Text variant="muted">
                  {t(
                    'Issues will be created when the query value passes the set threshold.'
                  )}
                </Text>
              </Stack>
              {(['highThreshold', 'lowThreshold'] as const).map(name => (
                <group.AppField key={name} name={name}>
                  {field => (
                    <Flex align="center" gap="md">
                      <PriorityDot
                        priority={
                          name === 'highThreshold'
                            ? PriorityLevel.HIGH
                            : PriorityLevel.LOW
                        }
                      />
                      <Flex width="120px" flexShrink={0}>
                        <field.Meta.Label>
                          {name === 'highThreshold'
                            ? t('High priority')
                            : t('Low priority')}
                        </field.Meta.Label>
                      </Flex>
                      <Flex align="center" gap="md">
                        <field.Input
                          type="number"
                          style={{width: 120}}
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="-"
                          aria-label={
                            name === 'highThreshold'
                              ? t('High threshold')
                              : t('Low threshold')
                          }
                        />
                        <Text variant="muted">{isPercentage ? '%' : 'MB'}</Text>
                      </Flex>
                    </Flex>
                  )}
                </group.AppField>
              ))}
            </Stack>
          </FormSection>
        </Container>
      </Fragment>
    );
  },
});
