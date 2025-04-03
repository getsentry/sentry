import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useProjects from 'sentry/utils/useProjects';
import {
  isEAPError,
  isTraceError,
} from 'sentry/views/performance/newTraceDetails/traceGuards';

import type {TraceTree} from '../traceModels/traceTree';

interface TitleProps {
  representativeEvent: TraceTree.TraceEvent | null;
  traceSlug: string;
  tree: TraceTree;
}

function getTitle(event: TraceTree.TraceEvent | null) {
  if (!event || !('transaction' in event) || isEAPError(event) || isTraceError(event)) {
    return null;
  }

  const op = 'transaction.op' in event ? event['transaction.op'] : event.op;

  return (
    <Fragment>
      <strong>{op} - </strong>
      {event.transaction}
    </Fragment>
  );
}

export function Title({traceSlug, representativeEvent}: TitleProps) {
  const traceTitle = getTitle(representativeEvent);
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === representativeEvent?.project_slug);

  return (
    <div>
      {traceTitle ? (
        <TitleWrapper>
          {project && (
            <ProjectBadge
              hideName
              project={project}
              avatarSize={20}
              avatarProps={{
                hasTooltip: true,
                tooltip: project.slug,
              }}
            />
          )}
          <TitleText>{traceTitle}</TitleText>
        </TitleWrapper>
      ) : (
        <TitleText>
          <strong>{t('Trace')}</strong>
        </TitleText>
      )}
      <SubtitleText>
        Trace ID: {traceSlug}
        <CopyToClipboardButton borderless size="zero" iconSize="xs" text={traceSlug} />
      </SubtitleText>
    </div>
  );
}

const TitleWrapper = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;

const TitleText = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  ${p => p.theme.overflowEllipsis};
`;

const SubtitleText = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;
