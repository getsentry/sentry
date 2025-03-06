import {type ReactNode, useMemo} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import {Hovercard} from 'sentry/components/hovercard';
import {platformsWithNestedInstrumentationGuides} from 'sentry/data/platformCategories';
import {IconOpen, IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {traceAnalytics} from './traceAnalytics';

function Resource({
  title,
  subtitle,
  link,
}: {
  link: string;
  subtitle: ReactNode;
  title: string;
}) {
  const organization = useOrganization();

  return (
    <StyledLinkButton
      icon={<IconOpen />}
      borderless
      external
      href={link}
      onClick={() => {
        traceAnalytics.trackTraceConfigurationsDocsClicked(organization, title);
      }}
    >
      <ButtonContent>
        <ButtonTitle>{title}</ButtonTitle>
        <ButtonSubtitle>{subtitle}</ButtonSubtitle>
      </ButtonContent>
    </StyledLinkButton>
  );
}

type ParsedPlatform = {
  platformName: string;
  framework?: string;
};

function parsePlatform(platform: string): ParsedPlatform {
  const platformParts = platform.split('-');

  // For example: dotnet-google-cloud-functions, we want to split it into
  // platformName: dotnet, framework: google-cloud-functions
  if (platformParts.length >= 3) {
    return {platformName: platformParts[0]!, framework: platformParts.slice(1).join('-')};
  }

  // With some exceptions, all other project platforms have the following two structures:
  // 1. "{language}-{framework}", e.g. "javascript-nextjs"
  // 2. "{language}", e.g. "python"
  const [platformName, framework] = platformParts;

  if (platform === 'react-native') {
    return {platformName: platformName!};
  }

  if (platform.includes('awslambda')) {
    return {platformName: platformName!, framework: 'aws-lambda'};
  }

  if (platform.includes('gcpfunctions')) {
    return {platformName: platformName!, framework: 'gcp-functions'};
  }

  return {platformName: platformName!, framework: framework!};
}

export function getCustomInstrumentationLink(project: Project | undefined): string {
  // Default to JavaScript guide if project or platform is not available
  if (!project || !project.platform) {
    return `https://docs.sentry.io/platforms/javascript/tracing/instrumentation/custom-instrumentation/`;
  }

  const {platformName, framework} = parsePlatform(project.platform);

  return platformsWithNestedInstrumentationGuides.includes(project.platform) && framework
    ? `https://docs.sentry.io/platforms/${platformName}/guides/${framework}/tracing/instrumentation/custom-instrumentation/`
    : `https://docs.sentry.io/platforms/${platformName}/tracing/instrumentation/custom-instrumentation/`;
}

function getDistributedTracingLink(project: Project | undefined): string {
  // Default to JavaScript guide if project or platform is not available
  if (!project || !project.platform) {
    return `https://docs.sentry.io/platforms/javascript/tracing/trace-propagation/`;
  }

  const {platformName, framework} = parsePlatform(project.platform);

  return framework
    ? `https://docs.sentry.io/platforms/${platformName}/guides/${framework}/tracing/trace-propagation/`
    : `https://docs.sentry.io/platforms/${platformName}/tracing/trace-propagation/`;
}

type ResourceButtonsProps = {
  customInstrumentationLink: string;
  distributedTracingLink: string;
};

function ResourceButtons({
  customInstrumentationLink,
  distributedTracingLink,
}: ResourceButtonsProps) {
  return (
    <ButtonContainer>
      <Resource
        title={t('Custom Instrumentation')}
        subtitle={t('Add Custom Spans or Transactions to your traces')}
        link={customInstrumentationLink}
      />
      <Resource
        title={t('Distributed Tracing')}
        subtitle={t('See the whole trace across all your services')}
        link={distributedTracingLink}
      />
    </ButtonContainer>
  );
}

type TraceConfigurationsProps = {
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
};

export default function TraceConfigurations({
  rootEventResults,
}: TraceConfigurationsProps) {
  const {projects} = useProjects();

  const traceProject = useMemo(() => {
    return rootEventResults.data
      ? projects.find(p => p.id === rootEventResults.data.projectID)
      : undefined;
  }, [projects, rootEventResults.data]);

  const customInstrumentationLink = useMemo(
    () => getCustomInstrumentationLink(traceProject),
    [traceProject]
  );

  const distributedTracingLink = useMemo(
    () => getDistributedTracingLink(traceProject),
    [traceProject]
  );

  return (
    <ClassNames>
      {({css}) => (
        <Hovercard
          body={
            <ResourceButtons
              customInstrumentationLink={customInstrumentationLink}
              distributedTracingLink={distributedTracingLink}
            />
          }
          bodyClassName={css`
            padding: ${space(1)};
          `}
          position="top-end"
        >
          <Button
            size="sm"
            icon={<IconQuestion />}
            aria-label={t('trace configure resources')}
          >
            {t('Configure Traces')}
          </Button>
        </Hovercard>
      )}
    </ClassNames>
  );
}

const ButtonContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  align-items: flex-start;
`;

const ButtonContent = styled('div')`
  display: flex;
  flex-direction: column;
  text-align: left;
  white-space: pre-line;
  gap: ${space(0.25)};
`;

const ButtonTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const ButtonSubtitle = styled('div')`
  color: ${p => p.theme.gray300};
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledLinkButton = styled(LinkButton)`
  padding: ${space(1)};
  height: auto;
`;
