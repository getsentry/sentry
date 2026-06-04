import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {ClippedBox} from 'sentry/components/clippedBox';
import {parseAssembly} from 'sentry/components/events/interfaces/utils';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event, Frame} from 'sentry/types/event';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/platform';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils/defined';
import {getFileExtension} from 'sentry/utils/fileExtension';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import {Assembly} from './assembly';
import {ContextLineNumber} from './contextLineNumber';
import {FrameRegisters} from './frameRegisters';
import {FrameVariables} from './frameVariables';
import {usePrismTokensSourceContext} from './usePrismTokensSourceContext';
import {useSourceContext} from './useSourceContext';
import {hasPotentialSourceContext} from './utils';

type Props = {
  components: Array<SentryAppComponent<SentryAppSchemaStacktraceLink>>;
  event: Event;
  frame: Frame;
  registers: StacktraceType['registers'];
  className?: string;
  emptySourceNotation?: boolean;
  frameMeta?: Record<any, any>;
  hasAssembly?: boolean;
  hasContextRegisters?: boolean;
  hasContextSource?: boolean;
  hasContextVars?: boolean;
  hasScmSourceContext?: boolean;
  isExpanded?: boolean;
  isFirst?: boolean;
  platform?: PlatformKey;
  registersMeta?: Record<any, any>;
};

export function Context({
  hasContextVars = false,
  hasContextSource = false,
  hasContextRegisters = false,
  isExpanded = false,
  hasAssembly = false,
  emptySourceNotation = false,
  hasScmSourceContext = false,
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

  const shouldFetchSourceContext =
    hasScmSourceContext &&
    defined(project) &&
    !hasContextSource &&
    isExpanded &&
    hasPotentialSourceContext(frame);

  const {data: sourceContextData, isPending: isLoadingSourceContext} = useSourceContext(
    {
      event,
      frame,
      orgSlug: organization?.slug || '',
      projectSlug: project?.slug,
    },
    {enabled: shouldFetchSourceContext}
  );

  const scmContext: Frame['context'] | undefined = useMemo(() => {
    if (!sourceContextData?.context?.length) {
      return;
    }
    return sourceContextData.context;
  }, [sourceContextData]);

  // Use SCM-fetched context when the frame has no embedded context
  const effectiveContext = hasContextSource ? frame?.context : scmContext;
  const effectiveHasContextSource = hasContextSource || !!scmContext?.length;

  /**
   * frame.lineNo is the highlighted frame in the middle of the context
   */
  const activeLineNumber = frame.lineNo;
  const contextLines = isExpanded
    ? effectiveContext
    : effectiveContext?.filter(l => l[0] === activeLineNumber);

  const fileExtension = getFileExtension(frame.filename || frame.absPath || '') ?? '';
  const lines = usePrismTokensSourceContext({
    contextLines,
    lineNo: frame.lineNo,
    fileExtension,
  });

  const isLoadingScmContext = shouldFetchSourceContext && isLoadingSourceContext;

  if (
    !isLoadingScmContext &&
    !effectiveHasContextSource &&
    !hasContextVars &&
    !hasContextRegisters &&
    !hasAssembly
  ) {
    return emptySourceNotation ? (
      <EmptyContext>
        <StyledIconFlag size="xs" />
        {t('No additional details are available for this frame.')}
      </EmptyContext>
    ) : null;
  }

  const startLineNo = effectiveHasContextSource ? (effectiveContext?.[0]?.[0] ?? 0) : 0;

  const prismClassName = fileExtension ? `language-${fileExtension}` : '';

  return (
    <Wrapper
      start={startLineNo}
      startLineNo={startLineNo}
      className={`${className} context ${isExpanded ? 'expanded' : ''}`}
      data-test-id="frame-context"
    >
      {isLoadingScmContext ? (
        <EmptyContext>
          <LoadingIndicator mini size={16} />
          {t('Loading source context…')}
        </EmptyContext>
      ) : effectiveContext && lines.length > 0 ? (
        <CodeWrapper className={prismClassName}>
          <pre className={prismClassName}>
            <code className={prismClassName}>
              {lines.map((line, i) => {
                const contextLine = contextLines![i]!;
                const isActive = activeLineNumber === contextLine[0];

                return (
                  <Fragment key={i}>
                    <ContextLineWrapper isActive={isActive} data-test-id="context-line">
                      <ContextLineNumber
                        lineNumber={contextLine[0]}
                        isActive={isActive}
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
          <FrameVariables platform={platform} data={frame.vars} meta={frameMeta?.vars} />
        </StyledClippedBox>
      )}

      {hasContextRegisters && (
        <FrameRegisters
          registers={registers!}
          meta={registersMeta}
          deviceArch={event.contexts?.device?.arch}
        />
      )}

      {hasAssembly && <Assembly {...parseAssembly(frame.package)} />}
    </Wrapper>
  );
}

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
`;

const StyledIconFlag = styled(IconFlag)`
  margin-right: ${p => p.theme.space.md};
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
    font-size: ${p => p.theme.font.size.sm};
    white-space: pre-wrap;
    margin: 0;
    overflow: hidden;
    background: ${p => p.theme.tokens.background.primary};
    padding: 0;
    border-radius: 0;
  }
`;

const EmptyContext = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: 20px;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
`;

const ContextLineWrapper = styled('div')<{isActive: boolean}>`
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: ${p => p.theme.space.md};
  background: ${p =>
    p.isActive ? 'var(--prism-highlight-background)' : p.theme.tokens.background.primary};
  padding-right: ${p => p.theme.space.xl};
`;

const ContextLineCode = styled('div')`
  line-height: 24px;
  white-space: pre-wrap;
  vertical-align: middle;
`;
