import * as React from 'react';
import styled from '@emotion/styled';

import Annotated from 'sentry/components/events/meta/annotated';
import space from 'sentry/styles/space';
import {ExceptionType} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_TYPE} from 'sentry/types/stacktrace';

import Mechanism from './mechanism';
import StackTrace from './stackTrace';
import ExceptionTitle from './title';

type StackTraceProps = React.ComponentProps<typeof StackTrace>;

type Props = {
  event: Event;
  platform: StackTraceProps['platform'];
  type: STACK_TYPE;
  newestFirst?: boolean;
  stackView?: StackTraceProps['stackView'];
} & Pick<ExceptionType, 'values'> &
  Pick<
    React.ComponentProps<typeof StackTrace>,
    'groupingCurrentLevel' | 'hasHierarchicalGrouping'
  >;

function Content({
  newestFirst,
  event,
  stackView,
  groupingCurrentLevel,
  hasHierarchicalGrouping,
  platform,
  values,
  type,
}: Props) {
  if (!values) {
    return null;
  }

  const children = values.map((exc, excIdx) => (
    <div key={excIdx} className="exception">
      <ExceptionTitle type={exc.type} exceptionModule={exc?.module} />
      <Annotated object={exc} objectKey="value" required>
        {value => <StyledPre className="exc-message">{value}</StyledPre>}
      </Annotated>
      {exc.mechanism && <Mechanism data={exc.mechanism} />}
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
      />
    </div>
  ));

  if (newestFirst) {
    children.reverse();
  }

  return <div>{children}</div>;
}

export default Content;

const StyledPre = styled('pre')`
  margin-bottom: ${space(1)};
  margin-top: 0;
`;
