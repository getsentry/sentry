import {getStacktracePlatform} from 'sentry/components/events/interfaces/utils';
import type {ExceptionType, ExceptionValue} from 'sentry/types/event';

import {ExceptionContent} from './exception';
import {StackTraceContent} from './stackTrace';

type ExceptionProps = React.ComponentProps<typeof ExceptionContent>;
type Props = Pick<
  ExceptionProps,
  | 'stackType'
  | 'stackView'
  | 'projectSlug'
  | 'event'
  | 'newestFirst'
  | 'groupingCurrentLevel'
> & {
  exception?: ExceptionType;
  stacktrace?: ExceptionValue['stacktrace'];
};

export function CrashContent({
  event,
  stackView,
  stackType,
  newestFirst,
  projectSlug,
  groupingCurrentLevel,
  exception,
  stacktrace,
}: Props) {
  if (exception) {
    return (
      <ExceptionContent
        stackType={stackType}
        stackView={stackView}
        projectSlug={projectSlug}
        newestFirst={newestFirst}
        event={event}
        values={exception.values}
        groupingCurrentLevel={groupingCurrentLevel}
      />
    );
  }

  if (stacktrace) {
    const platform = getStacktracePlatform(event, stacktrace);

    return (
      <StackTraceContent
        stacktrace={stacktrace}
        stackView={stackView}
        newestFirst={newestFirst}
        event={event}
        platform={platform}
        groupingCurrentLevel={groupingCurrentLevel}
      />
    );
  }

  return null;
}
