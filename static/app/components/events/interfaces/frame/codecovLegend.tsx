import {useMemo} from 'react';
import styled from '@emotion/styled';

import {IconCircle, IconCircleFill} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, Frame, Organization} from 'sentry/types';
import {CodecovStatusCode} from 'sentry/types/integrations';
import useProjects from 'sentry/utils/useProjects';

import useStacktraceLink from './useStacktraceLink';

interface CodecovLegendProps {
  event: Event;
  frame: Frame;
  organization?: Organization;
}

export function CodecovLegend({event, frame, organization}: CodecovLegendProps) {
  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(p => p.id === event.projectID),
    [projects, event]
  );

  const {data, isLoading} = useStacktraceLink({
    event,
    frame,
    orgSlug: organization?.slug || '',
    projectSlug: project?.slug,
  });

  if (isLoading || !data || !data.codecov) {
    return null;
  }

  if (
    data.codecov.status !== CodecovStatusCode.COVERAGE_EXISTS ||
    data.config?.provider.key !== 'github'
  ) {
    return null;
  }

  return (
    <CodeCovLegendContainer>
      <LegendIcon>
        <IconCircleFill size="xs" color="green100" style={{position: 'absolute'}} />
        <IconCircle size="xs" color="green300" />
      </LegendIcon>
      <LegendLabel>{t('Covered')}</LegendLabel>
      <LegendIcon>
        <IconCircleFill size="xs" color="red100" style={{position: 'absolute'}} />
        <IconCircle size="xs" color="red300" />
      </LegendIcon>
      <LegendLabel>{t('Uncovered')}</LegendLabel>
      <LegendIcon>
        <IconCircleFill size="xs" color="yellow100" style={{position: 'absolute'}} />
        <IconCircle size="xs" color="yellow300" />
      </LegendIcon>
      <LegendLabel>{t('Partial')}</LegendLabel>
    </CodeCovLegendContainer>
  );
}

const LegendLabel = styled('span')`
  line-height: 0;
  padding-right: 4px;
`;
const LegendIcon = styled('span')`
  display: flex;
  gap: ${space(0.75)};
`;

const CodeCovLegendContainer = styled('div')`
  gap: ${space(1)};
  color: ${p => p.theme.subText};
  background-color: ${p => p.theme.background};
  font-family: ${p => p.theme.text.family};
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(0.25)} ${space(3)};
  box-shadow: ${p => p.theme.dropShadowLight};
  display: flex;
  justify-content: end;
  flex-direction: row;
  align-items: center;
  min-height: 28px;
`;
