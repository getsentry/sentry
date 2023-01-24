import {ExceptionType, ExceptionValue, PlatformType} from 'sentry/types';

import Exception from './exception';
import Stacktrace from './stackTrace';

type ExceptionProps = React.ComponentProps<typeof Exception>;
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

function CrashContent({
  event,
  stackView,
  stackType,
  newestFirst,
  projectSlug,
  groupingCurrentLevel,
  hasHierarchicalGrouping,
  exception,
  stacktrace,
}: Props) {
  const platform = (event.platform ?? 'other') as PlatformType;

  if (exception) {
    return (
      <Exception
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
      <Stacktrace
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
}

export default CrashContent;
