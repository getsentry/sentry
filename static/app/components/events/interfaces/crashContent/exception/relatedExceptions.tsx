import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ExceptionValue, StackTraceMechanism} from 'sentry/types';
import {defined} from 'sentry/utils';

type ExceptionGroupContextProps = {
  allExceptions: ExceptionValue[];
  mechanism?: StackTraceMechanism | null;
  newestFirst?: boolean;
};

type ExceptionTreeProps = {
  childExceptions: ExceptionValue[];
  exception?: ExceptionValue;
  parentException?: ExceptionValue;
};

function getExceptionName(exception: ExceptionValue) {
  if (exception.type) {
    return exception.value ? `${exception.type}: ${exception.value}` : exception.type;
  }

  return exception.value ?? t('Exception');
}

function ExceptionLink({exception, link}: {exception: ExceptionValue; link: boolean}) {
  const exceptionName = getExceptionName(exception);

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
    <StyledPre>
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
    </StyledPre>
  );
}

export function RelatedExceptions({
  allExceptions,
  mechanism,
  newestFirst,
}: ExceptionGroupContextProps) {
  if (!mechanism || !mechanism.is_exception_group) {
    return null;
  }

  const parentException = allExceptions.find(
    exc => exc.mechanism?.exception_id === mechanism.parent_id
  );
  const exception = allExceptions.find(
    exc => exc.mechanism?.exception_id === mechanism.exception_id
  );
  const childExceptions = allExceptions.filter(
    exc => exc.mechanism?.parent_id === mechanism.exception_id
  );

  if (newestFirst) {
    childExceptions.reverse();
  }

  return (
    <Fragment>
      <Heading>Related Exceptions</Heading>
      <ExceptionTree {...{parentException, exception, childExceptions}} />
    </Fragment>
  );
}

const Heading = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0 ${space(0.5)} 0;
  color: ${p => p.theme.subText};
`;

const StyledPre = styled('pre')`
  margin: 0;
  overflow-x: auto;
`;

const TreeChildLineSvg = styled('svg')`
  position: absolute;
  left: 6px;
  bottom: 50%;
`;

const TreeItem = styled('div')<{level: number}>`
  position: relative;
  display: grid;
  align-items: center;
  grid-template-columns: auto auto 1fr;
  gap: ${space(1)};
  padding-left: ${p => (p.level > 0 ? 20 : 0)}px;
  margin-left: ${p => Math.max((p.level - 1) * 20, 0)}px;
  height: 24px;
  white-space: nowrap;
`;

const Circle = styled('div')`
  border-radius: 50%;
  height: 12px;
  width: 12px;
  border: 1px solid ${p => p.theme.textColor};
`;
