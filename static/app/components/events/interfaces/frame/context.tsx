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

export function getCoverageColorClass(
  lines: [number, string][],
  lineCov: LineCoverage[],
  activeLineNo: number
): [Array<string>, boolean] {
  const lineCoverage = keyBy(lineCov, 0);
  let hasCoverage = false;
  const lineColors = lines.map(([lineNo]) => {
    const coverage = lineCoverage[lineNo]
      ? lineCoverage[lineNo][1]
      : Coverage.NOT_APPLICABLE;

    let color = '';
    switch (coverage) {
      case Coverage.COVERED:
        color = 'covered';
        break;
      case Coverage.NOT_COVERED:
        color = 'uncovered';
        break;
      case Coverage.PARTIAL:
        color = 'partial';
        break;
      case Coverage.NOT_APPLICABLE:
      // fallthrough
      default:
        break;
    }

    if (color !== '') {
      hasCoverage = true;
    }

    if (activeLineNo !== lineNo) {
      return color;
    }
    return color === '' ? 'active' : `active ${color}`;
  });

  return [lineColors, hasCoverage];
}

const Context = ({
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
}: Props) => {
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
        organization.features.includes('codecov-stacktrace-integration') &&
        isExpanded,
    }
  );

  const contextLines = isExpanded
    ? frame?.context
    : frame?.context?.filter(l => l[0] === frame.lineNo);

  const hasCoverageData =
    !isLoading && data?.codecov?.status === CodecovStatusCode.COVERAGE_EXISTS;

  const [lineColors = [], hasCoverage] =
    hasCoverageData && data!.codecov?.lineCoverage && !!frame.lineNo! && contextLines
      ? getCoverageColorClass(contextLines, data!.codecov?.lineCoverage, frame.lineNo)
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
      <div className="empty-context">
        <StyledIconFlag size="xs" />
        <p>{t('No additional details are available for this frame.')}</p>
      </div>
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
          const isActive = frame.lineNo === line[0];
          const hasComponents = isActive && components.length > 0;
          const showStacktraceLink = hasStacktraceLink && isActive;

          return (
            <StyledContextLine
              key={index}
              line={line}
              isActive={isActive}
              colorClass={lineColors[index] ?? ''}
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
            </StyledContextLine>
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

      {hasAssembly && (
        <Assembly {...parseAssembly(frame.package)} filePath={frame.absPath} />
      )}
    </Wrapper>
  );
};

export default withOrganization(Context);

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
`;

const StyledIconFlag = styled(IconFlag)`
  margin-right: ${space(1)};
`;

const StyledContextLine = styled(ContextLine)`
  background: inherit;
  z-index: 1000;
  list-style: none;

  &::marker {
    content: none;
  }

  &:before {
    content: counter(frame);
    counter-increment: frame;
    text-align: center;
    padding-left: ${space(3)};
    padding-right: ${space(1.5)};
    margin-right: ${space(1.5)};
    display: inline-block;
    height: 24px;
    background: transparent;
    z-index: 1;
    min-width: 58px;
    border-right-style: solid;
    border-right-color: transparent;
  }

  &.covered:before {
    background: ${p => p.theme.green100};
    border-right-color: ${p => p.theme.green300};
  }

  &.uncovered:before {
    background: ${p => p.theme.red100};
  }

  &.partial:before {
    background: ${p => p.theme.yellow100};
    border-right-style: dashed;
    border-right-color: ${p => p.theme.yellow300};
  }

  &.active {
    background: ${p => p.theme.stacktraceActiveBackground};
    color: ${p => p.theme.stacktraceActiveText};
  }

  &.active.partial:before {
    mix-blend-mode: screen;
    background: ${p => p.theme.yellow200};
  }

  &.active.covered:before {
    mix-blend-mode: screen;
    background: ${p => p.theme.green200};
  }

  &.active.uncovered:before {
    mix-blend-mode: screen;
    background: ${p => p.theme.red200};
  }
`;

const Wrapper = styled('ol')<{startLineNo: number}>`
  counter-reset: frame ${p => p.startLineNo - 1};

  && {
    border-radius: 0 !important;
  }
`;
