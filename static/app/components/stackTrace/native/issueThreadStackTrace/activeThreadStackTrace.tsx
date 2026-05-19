import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {
  ExceptionDescription,
  ExceptionHeader,
} from 'sentry/components/stackTrace/exceptionHeader';
import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {IssueFrameActions} from 'sentry/components/stackTrace/issueStackTrace/issueFrameActions';
import {IssueStackTraceFrameContext} from 'sentry/components/stackTrace/issueStackTrace/issueStackTraceFrameContext';
import {NativeIssueFrameActions} from 'sentry/components/stackTrace/native/frame/actions/nativeIssueActions';
import {NativeStackTraceFrames} from 'sentry/components/stackTrace/native/nativeStackTraceFrames';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import {t} from 'sentry/locale';
import type {ExceptionValue} from 'sentry/types/event';
import {isNativePlatform} from 'sentry/utils/platform';

import {useActiveThreadContext, useIssueThreadStackTraceContext} from './context';

export function ActiveThreadStackTrace() {
  const {event, hasScmSourceContext} = useIssueThreadStackTraceContext();
  const {activeException, platform, stacktrace} = useActiveThreadContext();

  if (!stacktrace) {
    return <NoStackTrace>{t('No stack trace available')}</NoStackTrace>;
  }

  if (!isNativePlatform(platform)) {
    return (
      <StackTraceProvider
        event={event}
        hasScmSourceContext={hasScmSourceContext}
        stacktrace={stacktrace}
        platform={platform}
      >
        <StackTraceFrames
          frameContextComponent={FrameContent}
          frameActionsComponent={IssueFrameActions}
        />
      </StackTraceProvider>
    );
  }

  return (
    <Flex direction="column" gap="lg">
      <ExceptionDetails exception={activeException} />
      <NativeStackTraceFrames
        frameActionsComponent={NativeIssueFrameActions}
        frameContextComponent={IssueStackTraceFrameContext}
      />
    </Flex>
  );
}

export function IssueThreadStackTraceSuspectCommits() {
  const {event, group, projectSlug} = useIssueThreadStackTraceContext();

  if (!group) {
    return null;
  }

  return (
    <ErrorBoundary mini message={t('There was an error loading suspect commits')}>
      <SuspectCommits projectSlug={projectSlug} eventId={event.id} group={group} />
    </ErrorBoundary>
  );
}

function ExceptionDetails({exception}: {exception: ExceptionValue | undefined}) {
  if (!exception) {
    return null;
  }

  const hasExceptionInfo = Boolean(exception.type || exception.value);
  if (!hasExceptionInfo) {
    return null;
  }

  return (
    <Flex direction="column" gap="sm">
      <div>
        <ExceptionHeader type={exception.type} module={exception.module} />
      </div>
      <ExceptionDescription value={exception.value} mechanism={exception.mechanism} />
    </Flex>
  );
}

const NoStackTrace = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;
