import {Fragment} from 'react';

import {InlineCode} from '@sentry/scraps/code';
import {useStore, withFieldGroup} from '@sentry/scraps/form';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t, tct} from 'sentry/locale';
import {PriorityLevel} from 'sentry/types/group';
import type {
  PreprodMeasurement,
  PreprodThresholdType,
} from 'sentry/types/workflowEngine/detectors';
import {useDetectorProject} from 'sentry/views/detectors/components/forms/common/scraps';
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
                <field.Radio.Group
                  value={field.state.value}
                  onChange={value => {
                    if (value === 'install_size' || value === 'download_size') {
                      field.handleChange(value);
                    }
                  }}
                >
                  <Grid columns={{zero: '1fr', md: 'repeat(2, 1fr)'}} gap="md">
                    {METRIC_OPTIONS.map(({value}) => (
                      <field.Radio.Item key={value} value={value}>
                        {getMetricLabelForPlatform(value, platform)}
                      </field.Radio.Item>
                    ))}
                  </Grid>
                </field.Radio.Group>
              )}
            </group.AppField>
          </FormSection>
        </Container>
        <Container>
          <FormSection step={3} title={t('Issue Detection')}>
            <Stack gap="lg">
              <group.AppField name="thresholdType">
                {field => (
                  <field.Radio.Group
                    value={field.state.value}
                    onChange={value => {
                      if (
                        value === 'absolute' ||
                        value === 'absolute_diff' ||
                        value === 'relative_diff'
                      ) {
                        field.handleChange(value);
                      }
                    }}
                  >
                    <Grid columns={{zero: '1fr', md: 'repeat(3, 1fr)'}} gap="md">
                      {MEASUREMENT_OPTIONS.map(({value, label, description}) => (
                        <field.Radio.Item
                          key={value}
                          value={value}
                          description={description}
                        >
                          {label}
                        </field.Radio.Item>
                      ))}
                    </Grid>
                  </field.Radio.Group>
                )}
              </group.AppField>
              {isDiffThreshold(thresholdType) && (
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
                      <field.Layout.Row
                        label={
                          name === 'highThreshold'
                            ? t('High priority')
                            : t('Low priority')
                        }
                      >
                        <Flex align="center" gap="md">
                          <field.Input
                            type="number"
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
                      </field.Layout.Row>
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
