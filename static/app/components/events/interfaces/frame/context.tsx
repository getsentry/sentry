import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import ClippedBox from 'sentry/components/clippedBox';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ContextLine from 'sentry/components/events/interfaces/frame/contextLine';
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
  SentryAppSchemaStacktraceLink,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {getFileExtension} from 'sentry/utils/fileExtension';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {usePrismTokens} from 'sentry/utils/usePrismTokens';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';

import {parseAssembly} from '../utils';

import {Assembly} from './assembly';
import ContextLineNumber from './contextLineNumber';
import {FrameRegisters} from './frameRegisters';
import {FrameVariables} from './frameVariables';
import {OpenInContextLine} from './openInContextLine';
import useStacktraceLink from './useStacktraceLink';

type Props = {
  components: SentryAppComponent<SentryAppSchemaStacktraceLink>[];
  event: Event;
  frame: Frame;
  registers: {[key: string]: string};
  className?: string;
  emptySourceNotation?: boolean;
  frameMeta?: Record<any, any>;
  hasAssembly?: boolean;
  hasContextRegisters?: boolean;
  hasContextSource?: boolean;
  hasContextVars?: boolean;
  isExpanded?: boolean;
  isFirst?: boolean;
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
  const hasSyntaxHighlighting =
    organization?.features?.includes('issue-details-stacktrace-syntax-highlighting') ??
    false;

  const hasStacktraceLinkInFrameFeatureFlag =
    organization?.features?.includes('issue-details-stacktrace-link-in-frame') ?? false;

  // This is the old design. Only show if the feature flag is not enabled for this organization.
  const hasStacktraceLink =
    frame.inApp && !!frame.filename && isExpanded && !hasStacktraceLinkInFrameFeatureFlag;

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

  const fileExtension = getFileExtension(frame.filename || '') ?? '';
  const lines = usePrismTokens({
    // Some events have context lines with newline characters at the end,
    // so we need to remove them to be consistent.
    code:
      contextLines?.map(([, code]) => code?.replaceAll(/\r?\n/g, '') ?? '').join('\n') ??
      '',
    language: fileExtension,
  });

  if (!hasContextSource && !hasContextVars && !hasContextRegisters && !hasAssembly) {
    return emptySourceNotation ? (
      <EmptyContext>
        <StyledIconFlag size="xs" />
        {t('No additional details are available for this frame.')}
      </EmptyContext>
    ) : null;
  }

  const startLineNo = hasContextSource ? frame.context[0][0] : 0;

  const prismClassName = fileExtension ? `language-${fileExtension}` : '';

  return (
    <Wrapper
      start={startLineNo}
      startLineNo={startLineNo}
      className={`${className} context ${isExpanded ? 'expanded' : ''}`}
      data-test-id="frame-context"
    >
      {frame.context && hasSyntaxHighlighting && lines.length > 0 ? (
        <CodeWrapper className={prismClassName}>
          <pre className={prismClassName}>
            <code className={prismClassName}>
              {lines.map((line, i) => {
                const contextLine = contextLines[i];
                const isActive = activeLineNumber === contextLine[0];
                const hasComponents = isActive && components.length > 0;
                const showStacktraceLink = hasStacktraceLink && isActive;

                return (
                  <Fragment key={i}>
                    <ContextLineWrapper isActive={isActive} data-test-id="context-line">
                      <ContextLineNumber
                        lineNumber={contextLine[0]}
                        isActive={isActive}
                        coverage={lineCoverage[i]}
                      />
                      <ContextLineCode>
                        {line.map((token, key) => (
                          <span key={key} className={token.className}>
                            {token.children}
                          </span>
                        ))}
                      </ContextLineCode>
                    </ContextLineWrapper>
                    {hasComponents && (
                      <ErrorBoundary mini>
                        <OpenInContextLine
                          key={i}
                          lineNo={contextLine[0]}
                          filename={frame.filename || ''}
                          components={components}
                        />
                      </ErrorBoundary>
                    )}
                    {showStacktraceLink && (
                      <ErrorBoundary customComponent={null}>
                        <StacktraceLink
                          key={i}
                          line={contextLine[1]}
                          frame={frame}
                          event={event}
                        />
                      </ErrorBoundary>
                    )}
                  </Fragment>
                );
              })}
            </code>
          </pre>
        </CodeWrapper>
      ) : null}

      {frame.context && !hasSyntaxHighlighting
        ? contextLines.map((line, index) => {
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
          })
        : null}

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

const CodeWrapper = styled('div')`
  position: relative;
  padding: 0;

  && pre {
    font-size: ${p => p.theme.fontSizeSmall};
    white-space: pre-wrap;
    margin: 0;
    overflow: hidden;
    background: ${p => p.theme.background};
    padding: 0;
    border-radius: 0;
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

const ContextLineWrapper = styled('div')<{isActive: boolean}>`
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: ${space(1)};
  background: ${p =>
    p.isActive ? 'var(--prism-highlight-background)' : p.theme.background};
  padding-right: ${space(2)};
`;

const ContextLineCode = styled('div')`
  line-height: 24px;
  white-space: pre-wrap;
  vertical-align: middle;
`;
