import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import RadioField from 'sentry/components/forms/fields/radioField';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import useProjects from 'sentry/utils/useProjects';

function getDefaultProject(projects: Project[]) {
  return projects.find(p => p.isMember) ?? projects[0];
}

export function DetectorTypeForm() {
  return (
    <FormContainer>
      <div>
        <Header>
          <h3>{t('Monitor type')}</h3>
          <p>
            {t("Monitor type can't be edited once the monitor has been created.")}{' '}
            <a href="#">{t('Learn more about monitor types.')}</a>
          </p>
        </Header>
        <MonitorTypeField />
      </div>
      <div>
        <Header>
          <h3>{t('Project and Environment')}</h3>
        </Header>
        <Flex>
          <ProjectField />
          <EnvironmentField />
        </Flex>
      </div>
    </FormContainer>
  );
}

function ProjectField() {
  const {projects, fetching} = useProjects();

  return (
    <StyledProjectField
      inline={false}
      flexibleControlStateSize
      stacked
      projects={projects}
      groupProjects={project => (project.isMember ? 'member' : 'all')}
      groups={[
        {key: 'member', label: t('My Projects')},
        {key: 'all', label: t('All Projects')},
      ]}
      name="project"
      placeholder={t('Project')}
      aria-label={t('Select Project')}
      disabled={fetching}
    />
  );
}

function EnvironmentField() {
  const {projects} = useProjects();
  const projectId = useFormField<string>('project');
  const currentProject = projectId
    ? projects.find(p => p.id === projectId)
    : getDefaultProject(projects);

  const environments = currentProject?.environments ?? [];

  return (
    <StyledEnvironmentField
      choices={[
        ['', t('All Environments')],
        ...(environments?.map(environment => [environment, environment]) ?? []),
      ]}
      inline={false}
      flexibleControlStateSize
      stacked
      name="environment"
      placeholder={t('Environment')}
      aria-label={t('Select Environment')}
    />
  );
}

function MonitorTypeField() {
  return (
    <StyledRadioField
      inline={false}
      flexibleControlStateSize
      name="detectorType"
      choices={[
        [
          'metric',
          t('Metric'),
          <Description
            key="description"
            text={t('Monitor error counts, transaction duration, and more!')}
            visualization={<MetricVisualization />}
          />,
        ],
        [
          'crons',
          t('Crons'),
          <Description
            key="description"
            text={t(
              'Monitor the uptime and performance of any scheduled, recurring jobs.'
            )}
            visualization={<CronsVisualization />}
          />,
        ],
        [
          'uptime',
          t('Uptime'),
          <Description
            key="description"
            text={t('Monitor the uptime of specific endpoint in your applications.')}
            visualization={<UptimeVisualization />}
          />,
        ],
      ]}
      required
    />
  );
}

const FormContainer = styled('div')`
  display: flex;
  flex-direction: column;
  max-width: ${p => p.theme.breakpoints.xlarge};
`;

const StyledProjectField = styled(SentryProjectSelectorField)`
  flex-grow: 1;
  max-width: 360px;
  padding-left: 0;
`;

const StyledEnvironmentField = styled(SelectField)`
  flex-grow: 1;
  max-width: 360px;
  padding-left: 0;
`;

const StyledRadioField = styled(RadioField)`
  flex-grow: 1;
  padding-left: 0;
  border-bottom: none;

  label {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    padding: ${space(3)} ${space(2)};
    border-radius: ${p => p.theme.borderRadius};
    border: 1px solid ${p => p.theme.border};
    background-color: ${p => p.theme.surface400};

    &:empty {
      display: none;
    }

    div:empty {
      display: none;
    }

    /* Markup for choice name and description is all divs :( */
    div:nth-child(2) {
      font-weight: ${p => p.theme.fontWeightBold};
    }

    &[aria-checked='true'] {
      border-color: ${p => p.theme.focusBorder};
      outline: solid 1px ${p => p.theme.focusBorder};
    }

    input[type='radio'] {
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      height: 1px;
      overflow: hidden;
      position: absolute;
      white-space: nowrap;
      width: 1px;
    }
  }
`;

const Header = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  margin-top: ${space(3)};
  margin-bottom: ${space(1)};

  h3 {
    margin: 0;
    font-size: ${p => p.theme.fontSize.lg};
  }
  p {
    margin: 0;
  }
`;

function Description({
  text,
  visualization,
}: {
  text: string;
  visualization: React.ReactNode;
}) {
  return (
    <Fragment>
      <span>{text}</span>
      <Visualization>{visualization}</Visualization>
    </Fragment>
  );
}

const Visualization = styled('div')`
  display: none;
  width: 480px;
  height: 56px;
  position: absolute;
  top: 0;
  bottom: 0;
  right: ${space(2)};
  margin-block: auto;

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    display: block;
  }
`;

function MetricVisualization() {
  const theme = useTheme();
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 480 56">
      <g opacity=".3">
        <path
          fill="url(#a)"
          d="M10.694 34.208 1.391 50.067a1 1 0 0 0-.137.506v4.443a1 1 0 0 0 1 1h478a1 1 0 0 0 1-1V17.224a1 1 0 0 0-.37-.777l-9.943-8.067a1 1 0 0 0-.63-.224h-19.904a1 1 0 0 0-.262.035l-20.053 5.431a1 1 0 0 1-.426.021l-9.411-1.57a.998.998 0 0 0-.354.004l-10.144 1.96a1 1 0 0 1-.524-.04l-9.462-3.356a1 1 0 0 0-.176-.044l-9.804-1.574a1 1 0 0 0-.579.08l-10.034 4.652a1 1 0 0 1-.579.08l-9.775-1.569a1.01 1.01 0 0 1-.23-.065l-9.716-4.093a.999.999 0 0 0-.744-.013l-9.821 3.743L338.3 14.45c-.121.031-.247.04-.372.025l-9.717-1.17a1.001 1.001 0 0 0-.554.092l-9.766 4.702a1 1 0 0 1-.351.096l-9.499.792a.992.992 0 0 0-.235.049l-10.492 3.526a1 1 0 0 1-.733-.038l-8.477-3.856a.997.997 0 0 1-.32-.232L277.396 7.183a1 1 0 0 0-1.558.11l-8.908 12.92a1 1 0 0 1-1.406.246l-9.062-6.482a.998.998 0 0 0-.681-.182l-9.577.96a1 1 0 0 1-.472-.067l-9.007-3.613a1 1 0 0 0-1.313.589l-9.219 25.573a1 1 0 0 1-.921.66l-9.9.192-9.999-.803a.999.999 0 0 0-.386.045l-9.855 3.163a1.005 1.005 0 0 1-.313.048l-30.742-.203a.893.893 0 0 1-.155-.013l-19.843-3.247a.984.984 0 0 0-.161-.013h-10.766a.996.996 0 0 1-.262-.035l-8.891-2.42-10.108-1.825a1.002 1.002 0 0 0-.178-.015h-10.89l-10.003.802a.999.999 0 0 1-.379-.042l-9.409-2.945a1 1 0 0 0-.427-.037L71.93 31.941a.968.968 0 0 1-.178.007L50.666 30.93H31.662a1 1 0 0 0-.406.086l-10.1 4.487a1 1 0 0 1-.61.065l-8.785-1.832a1 1 0 0 0-1.067.472Z"
        />
        <path
          stroke={theme.subText}
          strokeLinecap="round"
          strokeWidth="1.5"
          d="m1.254 50.301 9.44-16.093a1 1 0 0 1 1.067-.472l8.785 1.832a1 1 0 0 0 .61-.065l10.1-4.487a1 1 0 0 1 .406-.086h19.004l21.087 1.018c.06.003.119 0 .178-.007l10.674-1.392a1 1 0 0 1 .427.037l9.41 2.945c.122.038.25.053.378.042l10.003-.802h10.89c.06 0 .119.005.178.015l10.108 1.825 8.891 2.42a.996.996 0 0 0 .262.035h10.766c.054 0 .108.004.161.013l19.843 3.247a.99.99 0 0 0 .155.013l30.742.203c.106.001.212-.015.313-.047l9.855-3.164a.999.999 0 0 1 .386-.045l9.999.803 9.9-.191a1 1 0 0 0 .921-.661l9.219-25.573a1 1 0 0 1 1.313-.59l9.007 3.614a1 1 0 0 0 .472.067l9.577-.96a.998.998 0 0 1 .681.181l9.062 6.483a1.001 1.001 0 0 0 1.406-.245l8.908-12.92a1 1 0 0 1 1.558-.111l10.388 11.253c.09.098.199.177.32.232l8.477 3.857c.231.104.493.118.733.037l10.492-3.526a.997.997 0 0 1 .235-.049l9.499-.792a.999.999 0 0 0 .351-.096l9.766-4.702a.998.998 0 0 1 .554-.092l9.717 1.17c.125.015.251.006.372-.025l10.013-2.612 9.821-3.743a.999.999 0 0 1 .744.013l9.716 4.093c.074.03.151.053.23.065l9.775 1.57a1 1 0 0 0 .579-.08l10.034-4.653a1 1 0 0 1 .579-.08l9.804 1.574a1 1 0 0 1 .176.044l9.462 3.356a1 1 0 0 0 .524.04l10.144-1.96a1 1 0 0 1 .354-.005l9.411 1.571a1 1 0 0 0 .426-.02l20.053-5.432a1 1 0 0 1 .262-.035h19.904a1 1 0 0 1 .63.224l10.313 8.367"
          opacity=".8"
        />
      </g>
      <path
        stroke={theme.red300}
        strokeLinecap="round"
        strokeWidth="4"
        d="M233.675 10.658h245.414"
        opacity=".8"
      />
      <path
        stroke={theme.subText}
        strokeLinecap="round"
        strokeWidth="4"
        d="M2.698 36.355H231.51"
        opacity=".6"
      />
      <path
        stroke={theme.subText}
        strokeDasharray="4 4"
        strokeLinecap="round"
        d="M232.953 11.628v24.727"
        opacity=".6"
      />
      <path
        stroke={theme.blue100}
        strokeLinecap="round"
        strokeOpacity=".06"
        d="M232.953 5.81v49.938"
      />
      <defs>
        <linearGradient
          id="a"
          x1="276.405"
          x2="276.405"
          y1="56.016"
          y2="9.65"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={theme.subText} stopOpacity="0" />
          <stop offset="1" stopColor={theme.subText} stopOpacity=".2" />
        </linearGradient>
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
