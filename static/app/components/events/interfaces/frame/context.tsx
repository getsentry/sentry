import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import ClippedBox from 'sentry/components/clippedBox';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Frame} from 'sentry/types/event';
import type {
  LineCoverage,
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import {CodecovStatusCode, Coverage} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getFileExtension} from 'sentry/utils/fileExtension';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {parseAssembly} from '../utils';

import {Assembly} from './assembly';
import ContextLineNumber from './contextLineNumber';
import {FrameRegisters} from './frameRegisters';
import {FrameVariables} from './frameVariables';
import {usePrismTokensSourceContext} from './usePrismTokensSourceContext';
import {useStacktraceCoverage} from './useStacktraceCoverage';

type Props = {
  components: Array<SentryAppComponent<SentryAppSchemaStacktraceLink>>;
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
  platform?: PlatformKey;
  registersMeta?: Record<any, any>;
};

export function getLineCoverage(
  lines: Frame['context'],
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
  frame,
  event,
  className,
  frameMeta,
  registersMeta,
  platform,
}: Props) {
  const organization = useOrganization();

  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(p => p.id === event.projectID),
    [projects, event]
  );

  const {data: coverage, isPending: isLoadingCoverage} = useStacktraceCoverage(
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
    !isLoadingCoverage && coverage?.status === CodecovStatusCode.COVERAGE_EXISTS;

  const [lineCoverage = [], hasCoverage] =
    hasCoverageData && coverage?.lineCoverage && !!activeLineNumber! && contextLines
      ? getLineCoverage(contextLines, coverage.lineCoverage)
      : [];

  useRouteAnalyticsParams(
    hasCoverageData
      ? {
          has_line_coverage: hasCoverage,
        }
      : {}
  );

  const fileExtension = getFileExtension(frame.filename || '') ?? '';
  const lines = usePrismTokensSourceContext({
    contextLines,
    lineNo: frame.lineNo,
    fileExtension,
  });

  if (!hasContextSource && !hasContextVars && !hasContextRegisters && !hasAssembly) {
    return emptySourceNotation ? (
      <EmptyContext>
        <StyledIconFlag size="xs" />
        {t('No additional details are available for this frame.')}
      </EmptyContext>
    ) : null;
  }

  const startLineNo = hasContextSource ? frame.context[0]![0] : 0;

  const prismClassName = fileExtension ? `language-${fileExtension}` : '';

  return (
    <Wrapper
      start={startLineNo}
      startLineNo={startLineNo}
      className={`${className} context ${isExpanded ? 'expanded' : ''}`}
      data-test-id="frame-context"
    >
      {frame.context && lines.length > 0 ? (
        <CodeWrapper className={prismClassName}>
          <pre className={prismClassName}>
            <code className={prismClassName}>
              {lines.map((line, i) => {
                const contextLine = contextLines[i]!;
                const isActive = activeLineNumber === contextLine[0];

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
                  </Fragment>
                );
              })}
            </code>
          </pre>
        </CodeWrapper>
      ) : null}

      {hasContextVars && (
        <StyledClippedBox clipHeight={100}>
          <FrameVariables
            platform={platform}
            data={frame.vars ?? {}}
            meta={frameMeta?.vars}
          />
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

export default Context;

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

  && pre,
  && code {
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
