import React from 'react';

import {PlatformType, ExceptionType} from 'app/types';

import Exception from './exception';
import Stacktrace from './stacktrace';

type ExceptionProps = React.ComponentProps<typeof Exception>;
type Props = Pick<
  ExceptionProps,
  'stackType' | 'stackView' | 'projectId' | 'event' | 'newestFirst'
> & {
  exception?: ExceptionType;
  stacktrace?: React.ComponentProps<typeof Stacktrace>['stacktrace'];
};

const CrashContent = ({
  event,
  stackView,
  stackType,
  newestFirst,
  projectId,
  exception,
  stacktrace,
}: Props) => {
  const platform = (event.platform ?? 'other') as PlatformType;

  if (exception) {
    return (
      <Exception
        stackType={stackType}
        stackView={stackView}
        projectId={projectId}
        newestFirst={newestFirst}
        event={event}
        platform={platform}
        values={exception.values}
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
      />
    );
  }

  return null;
};
export default CrashContent;
