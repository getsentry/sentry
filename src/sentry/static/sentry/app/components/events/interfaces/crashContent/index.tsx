import React from 'react';
import PropTypes from 'prop-types';

import SentryTypes from 'app/sentryTypes';
import {PlatformType} from 'app/types';

import Exception from './exception';
import Stacktrace from './stacktrace';

type ExceptionProps = React.ComponentProps<typeof Exception>;
type StacktraceProps = React.ComponentProps<typeof Stacktrace>;
type Props = Pick<ExceptionProps, 'stackView' | 'projectId' | 'event' | 'newestFirst'> & {
  exception?: ExceptionProps['exception'];
  stacktrace?: StacktraceProps['stacktrace'];
  stackType?: ExceptionProps['stackType'];
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
        exception={exception}
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

CrashContent.propTypes = {
  event: SentryTypes.Event.isRequired,
  stackView: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  newestFirst: PropTypes.bool.isRequired,
  stackType: PropTypes.string,
  exception: PropTypes.object,
  stacktrace: PropTypes.object,
};

export default CrashContent;
