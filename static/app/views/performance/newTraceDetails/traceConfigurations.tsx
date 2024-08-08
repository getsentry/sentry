import {type ReactNode, useMemo} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import {Hovercard} from 'sentry/components/hovercard';
import {platformsWithNestedInstrumentationGuides} from 'sentry/data/platformCategories';
import {IconOpen, IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types';
import type {EventTransaction} from 'sentry/types/event';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';

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

function getCustomInstrumentationLink(project: Project): string | null {
  if (!project.platform) {
    return null;
  }

  // Except react-native, all other project platforms have the following two structures:
  // 1. "{language}-{framework}", e.g. "javascript-nextjs"
  // 2. "{language}", e.g. "python"
  const [platformName, framework] =
    project.platform === 'react-native'
      ? ['react-native', undefined]
      : project.platform.split('-');

  return platformsWithNestedInstrumentationGuides.includes(project.platform) && framework
    ? `https://docs.sentry.io/platforms/${platformName}/guides/${framework}/tracing/instrumentation/custom-instrumentation/`
    : `https://docs.sentry.io/platforms/${platformName}/tracing/instrumentation/custom-instrumentation/`;
}

type ResourceButtonsProps = {
  customInstrumentationLink: string;
};

function ResourceButtons({customInstrumentationLink}: ResourceButtonsProps) {
  return (
    <ButtonContainer>
      <Resource
        title={t('Custom Instrumentation')}
        subtitle={t('Add Custom Spans or Transactions to your traces')}
        link={customInstrumentationLink}
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
      : null;
  }, [projects, rootEventResults.data]);

  const customInstrumentationLink = useMemo(
    () => (traceProject ? getCustomInstrumentationLink(traceProject) : null),
    [traceProject]
  );

  if (!traceProject || !customInstrumentationLink) {
    return null;
  }

  return (
    <ClassNames>
      {({css}) => (
        <Hovercard
          body={<ResourceButtons customInstrumentationLink={customInstrumentationLink} />}
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
