import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {parseAsStringEnum, useQueryState} from 'nuqs';

import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';

import Hook from 'sentry/components/hook';
import {t, tct} from 'sentry/locale';
import {HookStore} from 'sentry/stores/hookStore';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeAutomationCreatePathname} from 'sentry/views/automations/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';

export function DetectorTypeForm() {
  const organization = useOrganization();

  return (
    <Stack gap="xl">
      <MonitorTypeField />
      <Text as="p" size="md">
        {tct('Want to just alert on an existing issue? [link:Create an issue alert].', {
          link: <Link to={makeAutomationCreatePathname(organization.slug)} />,
        })}
      </Text>
      <Text as="p" size="md">
        {t(
          'If you’re looking for an Error Monitors, those are created by Sentry. To customize an error monitor, click into an existing one.'
        )}
      </Text>
    </Stack>
  );
}

type SelectableDetectorType = Extract<
  DetectorType,
  | 'metric_issue'
  | 'monitor_check_in_failure'
  | 'uptime_domain_failure'
  | 'preprod_size_analysis'
>;

const ALLOWED_DETECTOR_TYPES = [
  'metric_issue',
  'monitor_check_in_failure',
  'uptime_domain_failure',
  'preprod_size_analysis',
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
  show?: boolean;
}

function MonitorTypeField() {
  const organization = useOrganization();
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
      description: t(
        'Monitor error counts, logs, application metrics, span duration, crash rates, and more.'
      ),
      visualization: <MetricVisualization />,
      infoBanner: canCreateMetricDetector ? undefined : (
        <Hook name="component:metric-alert-quota-message" />
      ),
      disabled: !canCreateMetricDetector,
    },
    {
      id: 'preprod_size_analysis',
      name: getDetectorTypeLabel('preprod_size_analysis'),
      description: t('Monitor mobile app build sizes and detect regressions.'),
      visualization: <MobileBuildVisualization />,
      show: !!organization?.features?.includes('preprod-size-monitors-frontend'),
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
    <Stack gap="md" role="radiogroup" aria-label={t('Monitor type')}>
      {options
        .filter(({show}) => show === undefined || show)
        .map(({id, name, description, visualization, infoBanner, disabled}) => {
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
              {infoBanner && (checked || disabled) && (
                <OptionInfo>{infoBanner}</OptionInfo>
              )}
            </OptionLabel>
          );
        })}
    </Stack>
  );
}

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
  border: 1px solid ${p => p.theme.tokens.border.primary};
  background-color: ${p => p.theme.tokens.background.primary};
  font-weight: ${p => p.theme.font.weight.sans.regular};
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
    outline: solid 1px ${p => p.theme.tokens.focus.default};
  }

  ${OptionBody} {
    opacity: ${p => (p.disabled ? 0.7 : 1)};
  }
`;

const OptionInfo = styled('div')`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  background-color: ${p => p.theme.tokens.background.secondary};
  font-size: ${p => p.theme.font.size.md};
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
  const defaultChartColor =
    theme.chart.getColorPalette(0)[0] ?? theme.tokens.graphics.accent.vibrant;

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

function MobileBuildVisualization() {
  const theme = useTheme();
  const danger = theme.colors.red400;
  const accent =
    theme.chart.getColorPalette(0)[0] ?? theme.tokens.graphics.accent.vibrant;
  const bg = theme.tokens.background.primary;

  return (
    <svg fill="none" viewBox="0 0 480 56">
      <rect x="0" y="0" width="480" height="27.6" fill={danger} fillOpacity="0.1" />
      <line
        x1="0"
        y1="27.6"
        x2="480"
        y2="27.6"
        stroke={danger}
        strokeWidth="0.5"
        strokeDasharray="2.4 2.4"
      />
      <polyline
        fill="none"
        stroke={accent}
        strokeWidth="1.0"
        points="7.9,38.5 18.1,40.1 28.3,42.4 38.5,39.4 48.7,49.2 58.9,38.7 69.1,22.6 79.3,41.0 89.5,41.9 99.7,33.6 109.9,40.3 120.0,43.2 130.2,38.3 140.4,44.8 150.6,38.8 160.8,42.3 171.0,39.9 181.2,15.9 191.4,42.6 201.6,39.6 211.8,40.6 222.0,38.1 232.2,42.8 242.4,40.5 252.5,39.0 262.7,41.5 272.9,40.1 283.1,39.4 293.3,8.5 303.5,41.0 313.7,42.1 323.9,38.7 334.1,49.2 344.3,39.2 354.5,42.4 364.7,39.7 374.9,38.5 385.1,43.0 395.2,16.6 405.4,38.8 415.6,40.8 425.8,41.7 436.0,38.3 446.2,41.2 456.4,39.6 466.6,42.3 476.8,40.3"
      />
      <circle cx="7.9" cy="38.5" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="18.1" cy="40.1" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="28.3" cy="42.4" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="38.5" cy="39.4" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="48.7" cy="49.2" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="58.9" cy="38.7" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="69.1" cy="22.6" r="2" fill={bg} strokeWidth="1.5" stroke={danger} />
      <circle cx="79.3" cy="41.0" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="89.5" cy="41.9" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="99.7" cy="33.6" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="109.9" cy="40.3" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="120.0" cy="43.2" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="130.2" cy="38.3" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="140.4" cy="44.8" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="150.6" cy="38.8" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="160.8" cy="42.3" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="171.0" cy="39.9" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="181.2" cy="15.9" r="2" fill={bg} strokeWidth="1.5" stroke={danger} />
      <circle cx="191.4" cy="42.6" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="201.6" cy="39.6" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="211.8" cy="40.6" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="222.0" cy="38.1" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="232.2" cy="42.8" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="242.4" cy="40.5" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="252.5" cy="39.0" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="262.7" cy="41.5" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="272.9" cy="40.1" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="283.1" cy="39.4" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="293.3" cy="8.5" r="2" fill={bg} strokeWidth="1.5" stroke={danger} />
      <circle cx="303.5" cy="41.0" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="313.7" cy="42.1" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="323.9" cy="38.7" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="334.1" cy="49.2" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="344.3" cy="39.2" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="354.5" cy="42.4" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="364.7" cy="39.7" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="374.9" cy="38.5" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="385.1" cy="43.0" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="395.2" cy="16.6" r="2" fill={bg} strokeWidth="1.5" stroke={danger} />
      <circle cx="405.4" cy="38.8" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="415.6" cy="40.8" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="425.8" cy="41.7" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="436.0" cy="38.3" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="446.2" cy="41.2" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="456.4" cy="39.6" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="466.6" cy="42.3" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
      <circle cx="476.8" cy="40.3" r="2" fill={bg} strokeWidth="1.5" stroke={accent} />
    </svg>
  );
}
