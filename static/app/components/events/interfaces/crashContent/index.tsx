import {ExceptionType, ExceptionValue, PlatformType} from 'sentry/types';

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
  | 'hasHierarchicalGrouping'
> & {
  exception?: ExceptionType;
  stacktrace?: ExceptionValue['stacktrace'];
};

export const CrashContent = ({
  event,
  stackView,
  stackType,
  newestFirst,
  projectSlug,
  groupingCurrentLevel,
  hasHierarchicalGrouping,
  exception,
  stacktrace,
}: Props) => {
  const platform = (event.platform ?? 'other') as PlatformType;

  if (exception) {
    return (
      <ExceptionContent
        stackType={stackType}
        stackView={stackView}
        projectSlug={projectSlug}
        newestFirst={newestFirst}
        event={event}
        platform={platform}
        values={exception.values}
        groupingCurrentLevel={groupingCurrentLevel}
        hasHierarchicalGrouping={hasHierarchicalGrouping}
      />
    );
  }

  if (stacktrace) {
    return (
      <StackTraceContent
        stacktrace={stacktrace}
        stackView={stackView}
        newestFirst={newestFirst}
        event={event}
        platform={platform}
        groupingCurrentLevel={groupingCurrentLevel}
        hasHierarchicalGrouping={hasHierarchicalGrouping}
      />
    );
  }

  return null;
};
