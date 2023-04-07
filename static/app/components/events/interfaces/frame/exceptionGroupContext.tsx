import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {hasExceptionGroupTree} from 'sentry/components/events/interfaces/frame/utils';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {space} from 'sentry/styles/space';
import {EntryType, Event, ExceptionValue, StackTraceMechanism} from 'sentry/types';
import {defined} from 'sentry/utils';

type ExceptionGroupContextProps = {
  event: Event;
  isNewestFrame?: boolean;
  mechanism?: StackTraceMechanism | null;
};

type ExceptionTreeProps = {
  childExceptions: ExceptionValue[];
  exception?: ExceptionValue;
  parentException?: ExceptionValue;
};

function ExceptionLink({exception, link}: {exception: ExceptionValue; link: boolean}) {
  const exceptionName = exception.type || exception.value;

  if (!defined(exception.mechanism?.exception_id) || !link) {
    return <div>{exceptionName}</div>;
  }

  return (
    <Button
      priority="link"
      onClick={() => {
        const linkedElement = document.getElementById(
          `exception-${exception.mechanism?.exception_id}`
        );
        linkedElement?.scrollIntoView({behavior: 'smooth'});
      }}
    >
      {exceptionName}
    </Button>
  );
}

function TreeChildLine({firstChild}: {firstChild?: boolean}) {
  return (
    <TreeChildLineSvg
      viewBox="0 0 10 24"
      stroke="currentColor"
      width="10px"
      height="24px"
    >
      <line x1="0" y1={firstChild ? 10 : 0} x2="0" y2="24" />
      <line x1="0" y1="24" x2="10" y2="24" />
    </TreeChildLineSvg>
  );
}

function ExceptionTreeItem({
  exception,
  level,
  firstChild,
  link = true,
}: {
  exception: ExceptionValue;
  level: number;
  firstChild?: boolean;
  link?: boolean;
}) {
  return (
    <TreeItem level={level} data-test-id="exception-tree-item">
      {level > 0 && <TreeChildLine firstChild={firstChild} />}
      <Circle />
      <ExceptionLink exception={exception} link={link} />
    </TreeItem>
  );
}

function ExceptionTree({
  parentException,
  exception,
  childExceptions,
}: ExceptionTreeProps) {
  if (!exception) {
    return null;
  }

  return (
    <div>
      {parentException && <ExceptionTreeItem exception={parentException} level={0} />}
      <ExceptionTreeItem
        exception={exception}
        level={parentException ? 1 : 0}
        firstChild
        link={false}
      />
      {childExceptions.map((childException, i) => (
        <ExceptionTreeItem
          key={childException.mechanism?.exception_id}
          exception={childException}
          level={parentException ? 2 : 1}
          firstChild={i === 0}
        />
      ))}
    </div>
  );
}

export function ExceptionGroupContext({
  event,
  mechanism,
  isNewestFrame,
}: ExceptionGroupContextProps) {
  if (!mechanism || !hasExceptionGroupTree({mechanism, isNewestFrame})) {
    return null;
  }

  const allExceptions: ExceptionValue[] =
    event.entries.find(entry => entry.type === EntryType.EXCEPTION)?.data?.values ?? [];

  const parentException = allExceptions.find(
    exc => exc.mechanism?.exception_id === mechanism.parent_id
  );
  const exception = allExceptions.find(
    exc => exc.mechanism?.exception_id === mechanism.exception_id
  );
  const childExceptions = allExceptions.filter(
    exc => exc.mechanism?.parent_id === mechanism.exception_id
  );

  const data = [
    {
      key: 'Related Exceptions',
      subject: 'Related Exceptions',
      value: <ExceptionTree {...{parentException, exception, childExceptions}} />,
    },
  ];
  return <KeyValueList data={data} isContextData />;
}

const TreeChildLineSvg = styled('svg')`
  position: absolute;
  left: 6px;
  bottom: 50%;
`;

const TreeItem = styled('div')<{level: number}>`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding-left: ${p => (p.level > 0 ? 20 : 0)}px;
  margin-left: ${p => Math.max((p.level - 1) * 20, 0)}px;
  height: 24px;
`;

const Circle = styled('div')`
  border-radius: 50%;
  height: 12px;
  width: 12px;
  border: 1px solid ${p => p.theme.textColor};
`;
