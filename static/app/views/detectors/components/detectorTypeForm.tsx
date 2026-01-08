import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {parseAsStringEnum, useQueryState} from 'nuqs';

import {Flex, Stack} from 'sentry/components/core/layout';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Radio} from 'sentry/components/core/radio';
import {Text} from 'sentry/components/core/text';
import Hook from 'sentry/components/hook';
import {t, tct} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {
  makeAutomationBasePathname,
  makeAutomationCreatePathname,
} from 'sentry/views/automations/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';

export function DetectorTypeForm() {
  const organization = useOrganization();

  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Text size="lg" bold>
          {t('Select monitor type')}
        </Text>
        <Text as="p">
          {tct(
            'Do you want to alert existing issues? Create a [newAlertLink:new alert], or [connectAlertLink:connect an existing one].',
            {
              newAlertLink: <Link to={makeAutomationCreatePathname(organization.slug)} />,
              connectAlertLink: (
                <Link to={makeAutomationBasePathname(organization.slug)} />
              ),
            }
          )}
        </Text>
      </Stack>
      <MonitorTypeField />
    </Stack>
  );
}

type SelectableDetectorType = Extract<
  DetectorType,
  'metric_issue' | 'monitor_check_in_failure' | 'uptime_domain_failure'
>;

const ALLOWED_DETECTOR_TYPES = [
  'metric_issue',
  'monitor_check_in_failure',
  'uptime_domain_failure',
] as const satisfies SelectableDetectorType[];

const detectorTypeParser = parseAsStringEnum(ALLOWED_DETECTOR_TYPES)
  .withOptions({history: 'replace', clearOnDefault: false})
  .withDefault(ALLOWED_DETECTOR_TYPES[0]);

export function useDetectorTypeQueryState() {
  return useQueryState('detectorType', detectorTypeParser);
}

interface DetectorTypeOption {
  description: string;
  id: SelectableDetectorType;
  name: string;
  visualization: React.ReactNode;
  disabled?: boolean;
  infoBanner?: React.ReactNode;
}

function MonitorTypeField() {
  const [selectedDetectorType, setDetectorType] = useDetectorTypeQueryState();

  const useMetricDetectorLimit =
    HookStore.get('react-hook:use-metric-detector-limit')[0] ?? (() => null);
  const quota = useMetricDetectorLimit();
  const canCreateMetricDetector = !quota?.hasReachedLimit;

  const handleChange = (value: SelectableDetectorType) => {
    setDetectorType(value);
  };

  const options: DetectorTypeOption[] = [
    {
      id: 'metric_issue',
      name: getDetectorTypeLabel('metric_issue'),
      description: t('Monitor error counts, transaction duration, and more!'),
      visualization: <MetricVisualization />,
      infoBanner: canCreateMetricDetector ? undefined : (
        <Hook name="component:metric-alert-quota-message" />
      ),
      disabled: !canCreateMetricDetector,
    },
    {
      id: 'monitor_check_in_failure',
      name: getDetectorTypeLabel('monitor_check_in_failure'),
      description: t(
        'Monitor the uptime and performance of any scheduled, recurring jobs.'
      ),
      visualization: <CronsVisualization />,
    },
    {
      id: 'uptime_domain_failure',
      name: getDetectorTypeLabel('uptime_domain_failure'),
      description: t('Monitor the uptime of specific endpoint in your applications.'),
      visualization: <UptimeVisualization />,
      infoBanner: tct(
        'By enabling uptime monitoring, you acknowledge that uptime check data may be stored outside your selected data region. [link:Learn more].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/organization/data-storage-location/#data-stored-in-us" />
          ),
        }
      ),
    },
  ];

  return (
    <RadioOptions role="radiogroup" aria-label={t('Monitor type')}>
      {options.map(({id, name, description, visualization, infoBanner, disabled}) => {
        const checked = selectedDetectorType === id;
        return (
          <OptionLabel key={id} aria-checked={checked} disabled={disabled}>
            <OptionBody>
              <Flex direction="column" gap="sm">
                <Radio
                  name="detectorType"
                  checked={checked}
                  onChange={() => handleChange(id)}
                  aria-label={name}
                  disabled={disabled}
                />
                <Text size="lg" bold variant={disabled ? 'muted' : undefined}>
                  {name}
                </Text>
                {description && (
                  <Text size="md" variant="muted">
                    {description}
                  </Text>
                )}
              </Flex>
              {visualization && <Visualization>{visualization}</Visualization>}
            </OptionBody>
            {infoBanner && (checked || disabled) && <OptionInfo>{infoBanner}</OptionInfo>}
          </OptionLabel>
        );
      })}
    </RadioOptions>
  );
}

const RadioOptions = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;

const OptionBody = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${p => p.theme.space.xl};
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const OptionLabel = styled('label')<{disabled?: boolean}>`
  display: grid;
  grid-template-columns: 1fr;
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.colors.surface500};
  font-weight: ${p => p.theme.fontWeight.normal};
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};
  overflow: hidden;

  input[type='radio'] {
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  &[aria-checked='true'] {
    border-color: ${p => p.theme.tokens.border.accent.vibrant};
    outline: solid 1px ${p => p.theme.tokens.border.accent.vibrant};
  }

  ${OptionBody} {
    opacity: ${p => (p.disabled ? 0.7 : 1)};
  }
`;

const OptionInfo = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  background-color: ${p => p.theme.backgroundSecondary};
  font-size: ${p => p.theme.fontSize.md};
`;

const Visualization = styled('div')`
  display: none;
  height: 56px;
  flex: 0 0 50%;
  max-width: 50%;

  > svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    display: block;
  }
`;

function MetricVisualization() {
  const theme = useTheme();
  const danger = theme.colors.red400;
  const defaultChartColor = theme.chart.getColorPalette(0)[0] ?? theme.colors.blue500;

  return (
    <svg fill="none" viewBox="0 0 480 56">
      <path
        fill={defaultChartColor}
        d="M4 50.5 0 56h480v-7.5l-4-4-4-2-4.1-6.5-4 2-4 3-4.1-5-3.5-1.5-4.6 9-4-2-4 1-4 3-4.1 4-4 .5-4 1-4.1-1.5-4-5.5-4-3.5-4.1 3.5-4-1.5-4 2.5-4.1-4.5-4 .5-4-3-4.1 3h-4l-4 3-4.1-1.5-4 5-4 3-4.1-18-4 3.5-4-22-4.1 34-4-4.5-4-2-4.1-4-4 5.5-4-5.5-4.1-5-4 6.5-4 4.5h-4.1l-4-4.5-4 4-4.1 4-4 2.5-4-.5-4.1-4-4 1.5-4-4.5-4.1 2.5-4-6.5-4-3.5-4.1 3-4-3.5-4 8-4.1-4.5-4 1-4-4L238 40l-4 4.5-4 5-4.1-1h-4l-4 1.5-4.1 1.5-4-6-4 5.5-4.1 2.3-4-2.8-4 3.5-4.1-3-4 2-4-.7-4.1-.8-4-6-4 4.5-4.1 2.3-4-1.3-4 2-4.1-.5-4 1.5h-4l-4.1-1.5-4 2.5-4-1H129l-4-3.5-4 2-4.1-1-4 2-4-1.5-4.1-1.5-4 1-4 2-4.1-2-4 2.5-4-1.5-4.1 2.5-4-2h-4l-4.1-5.5-4-2.5-4.1-7.5-4-30.5-4.6 31.5-3.5 3-4-2-4 2-4.1 3.5-4-3-4 2-4.1-2-4 6.5-4 4.5-4.1-3.5-4 2.5z"
      />
      <path fill={danger} d="M0-.5h480v29H0z" fillOpacity=".1" />
      <path
        fill={danger}
        d="M0 28.5v.3h1v-.5H0zm3 0v.3h2v-.5H3zm4 0v.3h2v-.5H7zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h2v-.5h-2zm4 0v.3h1v-.5h-1zm-479 0v.5h1v-1H0zm3 0v.5h2v-1H3zm4 0v.5h2v-1H7zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h2v-1h-2zm4 0v.5h1v-1h-1z"
      />
    </svg>
  );
}

function CronsVisualization() {
  const theme = useTheme();
  const danger = theme.colors.red400;
  const warning = theme.colors.yellow400;
  const success = theme.colors.green400;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 480 56">
      <rect
        width="229.834"
        height="20"
        x="247.208"
        y="17.991"
        fill={danger}
        fillOpacity=".1"
        rx="4"
      />
      <rect
        width="4"
        height="14"
        x=".254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="12.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="24.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="36.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="48.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="60.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="72.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="84.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="96.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="108.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="120.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="132.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="144.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="156.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="168.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="180.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="192.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="204.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="216.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="228.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="240.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect width="4" height="14" x="252.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="264.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="276.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="288.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="300.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="312.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="324.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="336.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="348.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="360.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="372.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="384.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="396.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="408.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="420.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="432.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="444.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="456.254" y="20.991" fill={warning} rx="2" />
      <rect width="4" height="14" x="468.254" y="20.991" fill={warning} rx="2" />
    </svg>
  );
}

function UptimeVisualization() {
  const theme = useTheme();
  const danger = theme.colors.red400;
  const success = theme.colors.green400;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 480 56">
      <rect
        width="229.834"
        height="20"
        x="247.208"
        y="17.991"
        fill={danger}
        fillOpacity=".1"
        rx="4"
      />
      <rect
        width="4"
        height="14"
        x=".254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="12.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="24.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="36.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="48.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="60.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="72.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="84.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="96.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="108.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="120.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="132.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="144.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="156.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="168.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="180.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="192.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="204.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="216.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="228.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect
        width="4"
        height="14"
        x="240.254"
        y="20.991"
        fill={success}
        opacity=".8"
        rx="2"
      />
      <rect width="4" height="14" x="252.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="264.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="276.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="288.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="300.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="312.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="324.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="336.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="348.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="360.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="372.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="384.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="396.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="408.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="420.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="432.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="444.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="456.254" y="20.991" fill={danger} rx="2" />
      <rect width="4" height="14" x="468.254" y="20.991" fill={danger} rx="2" />
    </svg>
  );
}
