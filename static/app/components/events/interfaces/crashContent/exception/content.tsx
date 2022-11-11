import styled from '@emotion/styled';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import Tooltip from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {ExceptionType} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_TYPE} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';

import {Mechanism} from './mechanism';
import StackTrace from './stackTrace';

type StackTraceProps = React.ComponentProps<typeof StackTrace>;

type Props = {
  event: Event;
  platform: StackTraceProps['platform'];
  type: STACK_TYPE;
  meta?: Record<any, any>;
  newestFirst?: boolean;
  stackView?: StackTraceProps['stackView'];
} & Pick<ExceptionType, 'values'> &
  Pick<
    React.ComponentProps<typeof StackTrace>,
    'groupingCurrentLevel' | 'hasHierarchicalGrouping'
  >;

export function Content({
  newestFirst,
  event,
  stackView,
  groupingCurrentLevel,
  hasHierarchicalGrouping,
  platform,
  values,
  type,
  meta,
}: Props) {
  if (!values) {
    return null;
  }

  const children = values.map((exc, excIdx) => {
    return (
      <div key={excIdx} className="exception">
        {defined(exc?.module) ? (
          <Tooltip title={tct('from [exceptionModule]', {exceptionModule: exc?.module})}>
            <Title>{exc.type}</Title>
          </Tooltip>
        ) : (
          <Title>{exc.type}</Title>
        )}
        <StyledPre className="exc-message">
          {meta?.[excIdx]?.value?.[''] && !exc.value ? (
            <AnnotatedText value={exc.value} meta={meta?.[excIdx]?.value?.['']} />
          ) : (
            exc.value
          )}
        </StyledPre>
        {exc.mechanism && (
          <Mechanism data={exc.mechanism} meta={meta?.[excIdx]?.mechanism} />
        )}
        <StackTrace
          data={
            type === STACK_TYPE.ORIGINAL
              ? exc.stacktrace
              : exc.rawStacktrace || exc.stacktrace
          }
          stackView={stackView}
          stacktrace={exc.stacktrace}
          expandFirstFrame={excIdx === values.length - 1}
          platform={platform}
          newestFirst={newestFirst}
          event={event}
          chainedException={values.length > 1}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta?.[excIdx]?.stacktrace}
        />
      </div>
    );
  });

  if (newestFirst) {
    children.reverse();
  }

  return <div>{children}</div>;
}

const StyledPre = styled('pre')`
  margin-bottom: ${space(1)};
  margin-top: 0;
`;

const Title = styled('h5')`
  margin-bottom: ${space(0.5)};
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
`;
