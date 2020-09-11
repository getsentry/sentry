import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Annotated from 'app/components/events/meta/annotated';
import ExceptionMechanism from 'app/components/events/interfaces/exceptionMechanism';
import {Event} from 'app/types';
import {Stacktrace, RawStacktrace} from 'app/types/stacktrace';

import ExceptionStacktraceContent from './exceptionStacktraceContent';
import ExceptionTitle from './exceptionTitle';

type ExceptionStacktraceContentProps = React.ComponentProps<
  typeof ExceptionStacktraceContent
>;

type Props = {
  event: Event;
  type: 'original' | 'minified';
  stackView: ExceptionStacktraceContentProps['stackView'];
  platform: ExceptionStacktraceContentProps['platform'];
  values: Array<ExceptionValue>;
  newestFirst?: boolean;
};

const ExceptionContent = ({
  newestFirst,
  event,
  stackView,
  platform,
  values,
  type,
}: Props) => {
  const children = values.map((exc, excIdx) => (
    <div key={excIdx} className="exception">
      <ExceptionTitle type={exc.type} exceptionModule={exc?.module} />
      <Annotated object={exc} objectKey="value" required>
        {value => <StyledPre className="exc-message">{value}</StyledPre>}
      </Annotated>
      {exc.mechanism && <ExceptionMechanism data={exc.mechanism} platform={platform} />}
      <ExceptionStacktraceContent
        data={type === 'original' ? exc.stacktrace : exc.rawStacktrace || exc.stacktrace}
        stackView={stackView}
        stacktrace={exc.stacktrace}
        expandFirstFrame={excIdx === values.length - 1}
        platform={platform}
        newestFirst={newestFirst}
        event={event}
        chainedException={values.length > 1}
      />
    </div>
  ));

  if (newestFirst) {
    children.reverse();
  }

  return <div>{children}</div>;
};

export default ExceptionContent;

const StyledPre = styled('pre')`
  margin-bottom: ${space(1)};
  margin-top: 0;
`;
