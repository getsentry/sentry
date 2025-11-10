import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from 'sentry/components/core/layout';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Radio} from 'sentry/components/core/radio';
import {Text} from 'sentry/components/core/text';
import Hook from 'sentry/components/hook';
import {t, tct} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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

interface DetectorTypeOption {
  description: string;
  id: DetectorType;
  name: string;
  visualization: React.ReactNode;
  disabled?: boolean;
  infoBanner?: React.ReactNode;
}

function MonitorTypeField() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedDetectorType = location.query.detectorType as DetectorType;

  const useMetricDetectorLimit =
    HookStore.get('react-hook:use-metric-detector-limit')[0] ?? (() => null);
  const quota = useMetricDetectorLimit();
  const canCreateMetricDetector = !quota?.hasReachedLimit;

  const handleChange = (value: DetectorType) => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        detectorType: value,
      },
    });
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
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.surface400};
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
    border-color: ${p => p.theme.focusBorder};
    outline: solid 1px ${p => p.theme.focusBorder};
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
  return (
    <svg viewBox="0 0 480 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_9122_2362)">
        <path
          d="M4.03361 50.5L0 56H480V48.5L475.966 44.5L471.933 42.5L467.899 36L463.866 38L459.832 41L455.798 36L452.269 34.5L447.731 43.5L443.697 41.5L439.664 42.5L435.63 45.5L431.597 49.5L427.563 50L423.529 51L419.496 49.5L415.462 44L411.429 40.5L407.395 44L403.361 42.5L399.328 45L395.294 40.5L391.26 41L387.227 38L383.193 41H379.16L375.126 44L371.092 42.5L367.059 47.5L363.025 50.5L358.992 32.5L354.958 36L350.924 14L346.891 48L342.857 43.5L338.824 41.5L334.79 37.5L330.756 43L326.723 37.5L322.689 32.5L318.655 39L314.622 43.5H310.588L306.555 39L302.521 43L298.487 47L294.454 49.5L290.42 49L286.387 45L282.353 46.5L278.319 42L274.286 44.5L270.252 38L266.218 34.5L262.185 37.5L258.151 34L254.118 42L250.084 37.5L246.05 38.5L242.017 34.5L237.983 40L233.95 44.5L229.916 49.5L225.882 48.5H221.849L217.815 50L213.782 51.5L209.748 45.5L205.714 51L201.681 53.2818L197.647 50.5L193.613 54L189.58 51L185.546 53L181.513 52.2818L177.479 51.5L173.445 45.5L169.412 50L165.378 52.2818L161.345 51L157.311 53L153.277 52.5L149.244 54H145.21L141.176 52.5L137.143 55L133.109 54H129.076L125.042 50.5L121.008 52.5L116.975 51.5L112.941 53.5L108.908 52L104.874 50.5L100.84 51.5L96.8067 53.5L92.7731 51.5L88.7395 54L84.7059 52.5L80.6723 55L76.6386 53H72.605L68.5714 47.5L64.5378 45L60.5042 37.5L56.4706 7L51.9328 38.5L48.4034 41.5L44.3697 39.5L40.3361 41.5L36.3025 45L32.2689 42L28.2353 44L24.2017 42L20.1681 48.5L16.1345 53L12.1008 49.5L8.06723 52L4.03361 50.5Z"
          fill="#7553FF"
        />
        <mask id="path-2-inside-1_9122_2362" fill="white">
          <path d="M0 -0.5H480V28.5H0V-0.5Z" />
        </mask>
        <path d="M0 -0.5H480V28.5H0V-0.5Z" fill="#FF002B" fillOpacity="0.1" />
        <path
          d="M0 28.5V28.75H1V28.5V28.25H0V28.5ZM3 28.5V28.75H5V28.5V28.25H3V28.5ZM7 28.5V28.75H9V28.5V28.25H7V28.5ZM11 28.5V28.75H13V28.5V28.25H11V28.5ZM15 28.5V28.75H17V28.5V28.25H15V28.5ZM19 28.5V28.75H21V28.5V28.25H19V28.5ZM23 28.5V28.75H25V28.5V28.25H23V28.5ZM27 28.5V28.75H29V28.5V28.25H27V28.5ZM31 28.5V28.75H33V28.5V28.25H31V28.5ZM35 28.5V28.75H37V28.5V28.25H35V28.5ZM39 28.5V28.75H41V28.5V28.25H39V28.5ZM43 28.5V28.75H45V28.5V28.25H43V28.5ZM47 28.5V28.75H49V28.5V28.25H47V28.5ZM51 28.5V28.75H53V28.5V28.25H51V28.5ZM55 28.5V28.75H57V28.5V28.25H55V28.5ZM59 28.5V28.75H61V28.5V28.25H59V28.5ZM63 28.5V28.75H65V28.5V28.25H63V28.5ZM67 28.5V28.75H69V28.5V28.25H67V28.5ZM71 28.5V28.75H73V28.5V28.25H71V28.5ZM75 28.5V28.75H77V28.5V28.25H75V28.5ZM79 28.5V28.75H81V28.5V28.25H79V28.5ZM83 28.5V28.75H85V28.5V28.25H83V28.5ZM87 28.5V28.75H89V28.5V28.25H87V28.5ZM91 28.5V28.75H93V28.5V28.25H91V28.5ZM95 28.5V28.75H97V28.5V28.25H95V28.5ZM99 28.5V28.75H101V28.5V28.25H99V28.5ZM103 28.5V28.75H105V28.5V28.25H103V28.5ZM107 28.5V28.75H109V28.5V28.25H107V28.5ZM111 28.5V28.75H113V28.5V28.25H111V28.5ZM115 28.5V28.75H117V28.5V28.25H115V28.5ZM119 28.5V28.75H121V28.5V28.25H119V28.5ZM123 28.5V28.75H125V28.5V28.25H123V28.5ZM127 28.5V28.75H129V28.5V28.25H127V28.5ZM131 28.5V28.75H133V28.5V28.25H131V28.5ZM135 28.5V28.75H137V28.5V28.25H135V28.5ZM139 28.5V28.75H141V28.5V28.25H139V28.5ZM143 28.5V28.75H145V28.5V28.25H143V28.5ZM147 28.5V28.75H149V28.5V28.25H147V28.5ZM151 28.5V28.75H153V28.5V28.25H151V28.5ZM155 28.5V28.75H157V28.5V28.25H155V28.5ZM159 28.5V28.75H161V28.5V28.25H159V28.5ZM163 28.5V28.75H165V28.5V28.25H163V28.5ZM167 28.5V28.75H169V28.5V28.25H167V28.5ZM171 28.5V28.75H173V28.5V28.25H171V28.5ZM175 28.5V28.75H177V28.5V28.25H175V28.5ZM179 28.5V28.75H181V28.5V28.25H179V28.5ZM183 28.5V28.75H185V28.5V28.25H183V28.5ZM187 28.5V28.75H189V28.5V28.25H187V28.5ZM191 28.5V28.75H193V28.5V28.25H191V28.5ZM195 28.5V28.75H197V28.5V28.25H195V28.5ZM199 28.5V28.75H201V28.5V28.25H199V28.5ZM203 28.5V28.75H205V28.5V28.25H203V28.5ZM207 28.5V28.75H209V28.5V28.25H207V28.5ZM211 28.5V28.75H213V28.5V28.25H211V28.5ZM215 28.5V28.75H217V28.5V28.25H215V28.5ZM219 28.5V28.75H221V28.5V28.25H219V28.5ZM223 28.5V28.75H225V28.5V28.25H223V28.5ZM227 28.5V28.75H229V28.5V28.25H227V28.5ZM231 28.5V28.75H233V28.5V28.25H231V28.5ZM235 28.5V28.75H237V28.5V28.25H235V28.5ZM239 28.5V28.75H241V28.5V28.25H239V28.5ZM243 28.5V28.75H245V28.5V28.25H243V28.5ZM247 28.5V28.75H249V28.5V28.25H247V28.5ZM251 28.5V28.75H253V28.5V28.25H251V28.5ZM255 28.5V28.75H257V28.5V28.25H255V28.5ZM259 28.5V28.75H261V28.5V28.25H259V28.5ZM263 28.5V28.75H265V28.5V28.25H263V28.5ZM267 28.5V28.75H269V28.5V28.25H267V28.5ZM271 28.5V28.75H273V28.5V28.25H271V28.5ZM275 28.5V28.75H277V28.5V28.25H275V28.5ZM279 28.5V28.75H281V28.5V28.25H279V28.5ZM283 28.5V28.75H285V28.5V28.25H283V28.5ZM287 28.5V28.75H289V28.5V28.25H287V28.5ZM291 28.5V28.75H293V28.5V28.25H291V28.5ZM295 28.5V28.75H297V28.5V28.25H295V28.5ZM299 28.5V28.75H301V28.5V28.25H299V28.5ZM303 28.5V28.75H305V28.5V28.25H303V28.5ZM307 28.5V28.75H309V28.5V28.25H307V28.5ZM311 28.5V28.75H313V28.5V28.25H311V28.5ZM315 28.5V28.75H317V28.5V28.25H315V28.5ZM319 28.5V28.75H321V28.5V28.25H319V28.5ZM323 28.5V28.75H325V28.5V28.25H323V28.5ZM327 28.5V28.75H329V28.5V28.25H327V28.5ZM331 28.5V28.75H333V28.5V28.25H331V28.5ZM335 28.5V28.75H337V28.5V28.25H335V28.5ZM339 28.5V28.75H341V28.5V28.25H339V28.5ZM343 28.5V28.75H345V28.5V28.25H343V28.5ZM347 28.5V28.75H349V28.5V28.25H347V28.5ZM351 28.5V28.75H353V28.5V28.25H351V28.5ZM355 28.5V28.75H357V28.5V28.25H355V28.5ZM359 28.5V28.75H361V28.5V28.25H359V28.5ZM363 28.5V28.75H365V28.5V28.25H363V28.5ZM367 28.5V28.75H369V28.5V28.25H367V28.5ZM371 28.5V28.75H373V28.5V28.25H371V28.5ZM375 28.5V28.75H377V28.5V28.25H375V28.5ZM379 28.5V28.75H381V28.5V28.25H379V28.5ZM383 28.5V28.75H385V28.5V28.25H383V28.5ZM387 28.5V28.75H389V28.5V28.25H387V28.5ZM391 28.5V28.75H393V28.5V28.25H391V28.5ZM395 28.5V28.75H397V28.5V28.25H395V28.5ZM399 28.5V28.75H401V28.5V28.25H399V28.5ZM403 28.5V28.75H405V28.5V28.25H403V28.5ZM407 28.5V28.75H409V28.5V28.25H407V28.5ZM411 28.5V28.75H413V28.5V28.25H411V28.5ZM415 28.5V28.75H417V28.5V28.25H415V28.5ZM419 28.5V28.75H421V28.5V28.25H419V28.5ZM423 28.5V28.75H425V28.5V28.25H423V28.5ZM427 28.5V28.75H429V28.5V28.25H427V28.5ZM431 28.5V28.75H433V28.5V28.25H431V28.5ZM435 28.5V28.75H437V28.5V28.25H435V28.5ZM439 28.5V28.75H441V28.5V28.25H439V28.5ZM443 28.5V28.75H445V28.5V28.25H443V28.5ZM447 28.5V28.75H449V28.5V28.25H447V28.5ZM451 28.5V28.75H453V28.5V28.25H451V28.5ZM455 28.5V28.75H457V28.5V28.25H455V28.5ZM459 28.5V28.75H461V28.5V28.25H459V28.5ZM463 28.5V28.75H465V28.5V28.25H463V28.5ZM467 28.5V28.75H469V28.5V28.25H467V28.5ZM471 28.5V28.75H473V28.5V28.25H471V28.5ZM475 28.5V28.75H477V28.5V28.25H475V28.5ZM479 28.5V28.75H480V28.5V28.25H479V28.5ZM0 28.5V29H1V28.5V28H0V28.5ZM3 28.5V29H5V28.5V28H3V28.5ZM7 28.5V29H9V28.5V28H7V28.5ZM11 28.5V29H13V28.5V28H11V28.5ZM15 28.5V29H17V28.5V28H15V28.5ZM19 28.5V29H21V28.5V28H19V28.5ZM23 28.5V29H25V28.5V28H23V28.5ZM27 28.5V29H29V28.5V28H27V28.5ZM31 28.5V29H33V28.5V28H31V28.5ZM35 28.5V29H37V28.5V28H35V28.5ZM39 28.5V29H41V28.5V28H39V28.5ZM43 28.5V29H45V28.5V28H43V28.5ZM47 28.5V29H49V28.5V28H47V28.5ZM51 28.5V29H53V28.5V28H51V28.5ZM55 28.5V29H57V28.5V28H55V28.5ZM59 28.5V29H61V28.5V28H59V28.5ZM63 28.5V29H65V28.5V28H63V28.5ZM67 28.5V29H69V28.5V28H67V28.5ZM71 28.5V29H73V28.5V28H71V28.5ZM75 28.5V29H77V28.5V28H75V28.5ZM79 28.5V29H81V28.5V28H79V28.5ZM83 28.5V29H85V28.5V28H83V28.5ZM87 28.5V29H89V28.5V28H87V28.5ZM91 28.5V29H93V28.5V28H91V28.5ZM95 28.5V29H97V28.5V28H95V28.5ZM99 28.5V29H101V28.5V28H99V28.5ZM103 28.5V29H105V28.5V28H103V28.5ZM107 28.5V29H109V28.5V28H107V28.5ZM111 28.5V29H113V28.5V28H111V28.5ZM115 28.5V29H117V28.5V28H115V28.5ZM119 28.5V29H121V28.5V28H119V28.5ZM123 28.5V29H125V28.5V28H123V28.5ZM127 28.5V29H129V28.5V28H127V28.5ZM131 28.5V29H133V28.5V28H131V28.5ZM135 28.5V29H137V28.5V28H135V28.5ZM139 28.5V29H141V28.5V28H139V28.5ZM143 28.5V29H145V28.5V28H143V28.5ZM147 28.5V29H149V28.5V28H147V28.5ZM151 28.5V29H153V28.5V28H151V28.5ZM155 28.5V29H157V28.5V28H155V28.5ZM159 28.5V29H161V28.5V28H159V28.5ZM163 28.5V29H165V28.5V28H163V28.5ZM167 28.5V29H169V28.5V28H167V28.5ZM171 28.5V29H173V28.5V28H171V28.5ZM175 28.5V29H177V28.5V28H175V28.5ZM179 28.5V29H181V28.5V28H179V28.5ZM183 28.5V29H185V28.5V28H183V28.5ZM187 28.5V29H189V28.5V28H187V28.5ZM191 28.5V29H193V28.5V28H191V28.5ZM195 28.5V29H197V28.5V28H195V28.5ZM199 28.5V29H201V28.5V28H199V28.5ZM203 28.5V29H205V28.5V28H203V28.5ZM207 28.5V29H209V28.5V28H207V28.5ZM211 28.5V29H213V28.5V28H211V28.5ZM215 28.5V29H217V28.5V28H215V28.5ZM219 28.5V29H221V28.5V28H219V28.5ZM223 28.5V29H225V28.5V28H223V28.5ZM227 28.5V29H229V28.5V28H227V28.5ZM231 28.5V29H233V28.5V28H231V28.5ZM235 28.5V29H237V28.5V28H235V28.5ZM239 28.5V29H241V28.5V28H239V28.5ZM243 28.5V29H245V28.5V28H243V28.5ZM247 28.5V29H249V28.5V28H247V28.5ZM251 28.5V29H253V28.5V28H251V28.5ZM255 28.5V29H257V28.5V28H255V28.5ZM259 28.5V29H261V28.5V28H259V28.5ZM263 28.5V29H265V28.5V28H263V28.5ZM267 28.5V29H269V28.5V28H267V28.5ZM271 28.5V29H273V28.5V28H271V28.5ZM275 28.5V29H277V28.5V28H275V28.5ZM279 28.5V29H281V28.5V28H279V28.5ZM283 28.5V29H285V28.5V28H283V28.5ZM287 28.5V29H289V28.5V28H287V28.5ZM291 28.5V29H293V28.5V28H291V28.5ZM295 28.5V29H297V28.5V28H295V28.5ZM299 28.5V29H301V28.5V28H299V28.5ZM303 28.5V29H305V28.5V28H303V28.5ZM307 28.5V29H309V28.5V28H307V28.5ZM311 28.5V29H313V28.5V28H311V28.5ZM315 28.5V29H317V28.5V28H315V28.5ZM319 28.5V29H321V28.5V28H319V28.5ZM323 28.5V29H325V28.5V28H323V28.5ZM327 28.5V29H329V28.5V28H327V28.5ZM331 28.5V29H333V28.5V28H331V28.5ZM335 28.5V29H337V28.5V28H335V28.5ZM339 28.5V29H341V28.5V28H339V28.5ZM343 28.5V29H345V28.5V28H343V28.5ZM347 28.5V29H349V28.5V28H347V28.5ZM351 28.5V29H353V28.5V28H351V28.5ZM355 28.5V29H357V28.5V28H355V28.5ZM359 28.5V29H361V28.5V28H359V28.5ZM363 28.5V29H365V28.5V28H363V28.5ZM367 28.5V29H369V28.5V28H367V28.5ZM371 28.5V29H373V28.5V28H371V28.5ZM375 28.5V29H377V28.5V28H375V28.5ZM379 28.5V29H381V28.5V28H379V28.5ZM383 28.5V29H385V28.5V28H383V28.5ZM387 28.5V29H389V28.5V28H387V28.5ZM391 28.5V29H393V28.5V28H391V28.5ZM395 28.5V29H397V28.5V28H395V28.5ZM399 28.5V29H401V28.5V28H399V28.5ZM403 28.5V29H405V28.5V28H403V28.5ZM407 28.5V29H409V28.5V28H407V28.5ZM411 28.5V29H413V28.5V28H411V28.5ZM415 28.5V29H417V28.5V28H415V28.5ZM419 28.5V29H421V28.5V28H419V28.5ZM423 28.5V29H425V28.5V28H423V28.5ZM427 28.5V29H429V28.5V28H427V28.5ZM431 28.5V29H433V28.5V28H431V28.5ZM435 28.5V29H437V28.5V28H435V28.5ZM439 28.5V29H441V28.5V28H439V28.5ZM443 28.5V29H445V28.5V28H443V28.5ZM447 28.5V29H449V28.5V28H447V28.5ZM451 28.5V29H453V28.5V28H451V28.5ZM455 28.5V29H457V28.5V28H455V28.5ZM459 28.5V29H461V28.5V28H459V28.5ZM463 28.5V29H465V28.5V28H463V28.5ZM467 28.5V29H469V28.5V28H467V28.5ZM471 28.5V29H473V28.5V28H471V28.5ZM475 28.5V29H477V28.5V28H475V28.5ZM479 28.5V29H480V28.5V28H479V28.5Z"
          fill="#FF002B"
          mask="url(#path-2-inside-1_9122_2362)"
        />
      </g>
      <defs>
        <clipPath id="clip0_9122_2362">
          <rect width="480" height="56" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function CronsVisualization() {
  const theme = useTheme();
  const danger = theme.red300;
  const warning = theme.yellow300;
  const success = theme.green300;
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
  const danger = theme.red300;
  const success = theme.green300;
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
