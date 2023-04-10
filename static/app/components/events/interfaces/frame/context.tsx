import {useMemo} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import ClippedBox from 'sentry/components/clippedBox';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {StacktraceLink} from 'sentry/components/events/interfaces/frame/stacktraceLink';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  CodecovStatusCode,
  Coverage,
  Frame,
  LineCoverage,
  Organization,
  SentryAppComponent,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';

import {parseAssembly} from '../utils';

import {Assembly} from './assembly';
import ContextLine from './contextLine';
import {FrameRegisters} from './frameRegisters';
import {FrameVariables} from './frameVariables';
import {OpenInContextLine} from './openInContextLine';
import useStacktraceLink from './useStacktraceLink';

type Props = {
  components: Array<SentryAppComponent>;
  event: Event;
  frame: Frame;
  registers: {[key: string]: string};
  className?: string;
  emptySourceNotation?: boolean;
  expandable?: boolean;
  frameMeta?: Record<any, any>;
  hasAssembly?: boolean;
  hasContextRegisters?: boolean;
  hasContextSource?: boolean;
  hasContextVars?: boolean;
  isExpanded?: boolean;
  organization?: Organization;
  registersMeta?: Record<any, any>;
};

export function getLineCoverage(
  lines: [number, string][],
  lineCov: LineCoverage[]
): [Array<Coverage | undefined>, boolean] {
  const keyedCoverage = keyBy(lineCov, 0);
  const lineCoverage = lines.map<Coverage | undefined>(
    ([lineNo]) => keyedCoverage[lineNo]?.[1]
  );
  const hasCoverage = lineCoverage.some(
    coverage => coverage !== Coverage.NOT_APPLICABLE && coverage !== undefined
  );

  return [lineCoverage, hasCoverage];
}

function Context({
  hasContextVars = false,
  hasContextSource = false,
  hasContextRegisters = false,
  isExpanded = false,
  hasAssembly = false,
  expandable = false,
  emptySourceNotation = false,
  registers,
  components,
  frame,
  event,
  organization,
  className,
  frameMeta,
  registersMeta,
}: Props) {
  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(p => p.id === event.projectID),
    [projects, event]
  );

  const {data, isLoading} = useStacktraceLink(
    {
      event,
      frame,
      orgSlug: organization?.slug || '',
      projectSlug: project?.slug,
    },
    {
      enabled:
        defined(organization) &&
        defined(project) &&
        !!organization.codecovAccess &&
        isExpanded,
    }
  );

  /**
   * frame.lineNo is the highlighted frame in the middle of the context
   */
  const activeLineNumber = frame.lineNo;
  const contextLines = isExpanded
    ? frame?.context
    : frame?.context?.filter(l => l[0] === activeLineNumber);

  const hasCoverageData =
    !isLoading && data?.codecov?.status === CodecovStatusCode.COVERAGE_EXISTS;

  const [lineCoverage = [], hasCoverage] =
    hasCoverageData && data!.codecov?.lineCoverage && !!activeLineNumber! && contextLines
      ? getLineCoverage(contextLines, data!.codecov?.lineCoverage)
      : [];

  useRouteAnalyticsParams(
    hasCoverageData
      ? {
          has_line_coverage: hasCoverage,
        }
      : {}
  );

  if (!hasContextSource && !hasContextVars && !hasContextRegisters && !hasAssembly) {
    return emptySourceNotation ? (
      <EmptyContext>
        <StyledIconFlag size="xs" />
        {t('No additional details are available for this frame.')}
      </EmptyContext>
    ) : null;
  }

  const startLineNo = hasContextSource ? frame.context[0][0] : 0;
  const hasStacktraceLink =
    frame.inApp &&
    !!frame.filename &&
    isExpanded &&
    organization?.features.includes('integrations-stacktrace-link');

  return (
    <Wrapper
      start={startLineNo}
      startLineNo={startLineNo}
      className={`${className} context ${isExpanded ? 'expanded' : ''}`}
    >
      {defined(frame.errors) && (
        <li className={expandable ? 'expandable error' : 'error'} key="errors">
          {frame.errors.join(', ')}
        </li>
      )}

      {frame.context &&
        contextLines.map((line, index) => {
          const isActive = activeLineNumber === line[0];
          const hasComponents = isActive && components.length > 0;
          const showStacktraceLink = hasStacktraceLink && isActive;

          return (
            <ContextLine
              key={index}
              line={line}
              isActive={isActive}
              coverage={lineCoverage[index]}
            >
              {hasComponents && (
                <ErrorBoundary mini>
                  <OpenInContextLine
                    key={index}
                    lineNo={line[0]}
                    filename={frame.filename || ''}
                    components={components}
                  />
                </ErrorBoundary>
              )}
              {showStacktraceLink && (
                <ErrorBoundary customComponent={null}>
                  <StacktraceLink
                    key={index}
                    line={line[1]}
                    frame={frame}
                    event={event}
                  />
                </ErrorBoundary>
              )}
            </ContextLine>
          );
        })}

      {hasContextVars && (
        <StyledClippedBox clipHeight={100}>
          <FrameVariables data={frame.vars ?? {}} meta={frameMeta?.vars} />
        </StyledClippedBox>
      )}

      {hasContextRegisters && (
        <FrameRegisters
          registers={registers}
          meta={registersMeta}
          deviceArch={event.contexts?.device?.arch}
        />
      )}

      {hasAssembly && <Assembly {...parseAssembly(frame.package)} />}
    </Wrapper>
  );
}

export default withOrganization(Context);

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
`;

const StyledIconFlag = styled(IconFlag)`
  margin-right: ${space(1)};
`;

const Wrapper = styled('ol')<{startLineNo: number}>`
  counter-reset: frame ${p => p.startLineNo - 1};

  && {
    border-radius: 0 !important;
  }
`;

const EmptyContext = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: 20px;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;
