import {useMemo} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import ClippedBox from 'sentry/components/clippedBox';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {
  isMobileLanguage,
  StacktraceLink,
} from 'sentry/components/events/interfaces/frame/stacktraceLink';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
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
import {Color} from 'sentry/utils/theme';
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

export function getCoverageColors(
  lines: [number, string][],
  lineCov: LineCoverage[]
): Array<Color | 'transparent'> {
  const lineCoverage = keyBy(lineCov, 'lineNo');
  return lines.map(line => {
    const coverage = lineCoverage[line[0]]
      ? lineCoverage[line[0]].coverage
      : Coverage.NOT_APPLICABLE;
    switch (coverage) {
      case Coverage.COVERED:
        return 'green100';
      case Coverage.NOT_COVERED:
        return 'red100';
      case Coverage.PARTIAL:
        return 'yellow100';
      case Coverage.NOT_APPLICABLE:
      // fallthrough
      default:
        return 'transparent';
    }
  });
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
  const isMobile = isMobileLanguage(event);
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

  if (
    !hasContextSource &&
    !hasContextVars &&
    !hasContextRegisters &&
    !hasAssembly &&
    !isMobile
  ) {
    return emptySourceNotation ? (
      <div className="empty-context">
        <StyledIconFlag size="xs" />
        <p>{t('No additional details are available for this frame.')}</p>
      </div>
    ) : null;
  }

  // Temporarily allow mobile platforms to make API call and "show" stacktrace link
  if (isMobile) {
    if (
      event.platform !== 'java' ||
      (event.platform === 'java' && frame?.module?.startsWith('com.'))
    ) {
      return (
        <ErrorBoundary customComponent={null}>
          <StacktraceLink
            line={frame.function ? frame.function : ''}
            frame={frame}
            event={event}
          />
        </ErrorBoundary>
      );
    }
  }

  const contextLines = isExpanded
    ? frame.context
    : frame.context.filter(l => l[0] === frame.lineNo);

  const startLineNo = hasContextSource ? frame.context[0][0] : undefined;
  const hasStacktraceLink =
    frame.inApp &&
    !!frame.filename &&
    isExpanded &&
    organization?.features.includes('integrations-stacktrace-link');

  const shouldShowCodecovData =
    organization?.features.includes('codecov-stacktrace-integration') &&
    organization?.codecovAccess;
  const missingData =
    isLoading || !data || data?.codecovStatusCode !== CodecovStatusCode.COVERAGE_EXISTS;

  const lineColors: Array<Color | 'transparent'> =
    shouldShowCodecovData && !missingData && data.lineCoverage!
      ? getCoverageColors(contextLines, data.lineCoverage)
      : [];

  return (
    <Wrapper
      start={startLineNo}
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
              color={isActive ? 'transparent' : lineColors[index] ?? 'transparent'}
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
  padding: 0;
  text-indent: 20px;
  z-index: 1000;
`;

const Wrapper = styled('ol')`
  && {
    border-radius: 0;
  }
`;
