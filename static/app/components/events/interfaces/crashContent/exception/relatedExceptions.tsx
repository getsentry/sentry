import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ExceptionValue, StackTraceMechanism} from 'sentry/types';
import {defined} from 'sentry/utils';

type ExceptionGroupContextProps = {
  allExceptions: ExceptionValue[];
  onExceptionClick: (exceptionId: number) => void;
  mechanism?: StackTraceMechanism | null;
  newestFirst?: boolean;
};

type ExceptionTreeProps = {
  childExceptions: ExceptionValue[];
  onExceptionClick: (exceptionId: number) => void;
  exception?: ExceptionValue;
  parentException?: ExceptionValue;
};

type ExceptionLinkProps = {
  exception: ExceptionValue;
  link: boolean;
  onExceptionClick: (exceptionId: number) => void;
};

type ExceptionTreeItemProps = {
  exception: ExceptionValue;
  level: number;
  onExceptionClick: (exceptionId: number) => void;
  firstChild?: boolean;
  link?: boolean;
};

function getExceptionName(exception: ExceptionValue) {
  if (exception.type) {
    return exception.value ? `${exception.type}: ${exception.value}` : exception.type;
  }

  return exception.value ?? t('Exception');
}

function ExceptionLink({exception, link, onExceptionClick}: ExceptionLinkProps) {
  const exceptionName = getExceptionName(exception);

  const exceptionId = exception.mechanism?.exception_id;

  if (!defined(exceptionId) || !link) {
    return <div>{exceptionName}</div>;
  }

  return (
    <Button
      priority="link"
      onClick={() => {
        onExceptionClick(exceptionId);

        // Schedule the scroll event for next render because it may not be visible until expanded
        setTimeout(() => {
          const linkedElement = document.getElementById(`exception-${exceptionId}`);
          linkedElement?.scrollIntoView?.({behavior: 'smooth'});
        }, 0);
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
  onExceptionClick,
}: ExceptionTreeItemProps) {
  return (
    <TreeItem level={level} data-test-id="exception-tree-item">
      {level > 0 && <TreeChildLine firstChild={firstChild} />}
      <Circle />
      <ExceptionLink
        exception={exception}
        link={link}
        onExceptionClick={onExceptionClick}
      />
    </TreeItem>
  );
}

function ExceptionTree({
  parentException,
  exception,
  childExceptions,
  onExceptionClick,
}: ExceptionTreeProps) {
  if (!exception) {
    return null;
  }

  return (
    <StyledPre>
      {parentException && (
        <ExceptionTreeItem
          exception={parentException}
          level={0}
          onExceptionClick={onExceptionClick}
        />
      )}
      <ExceptionTreeItem
        exception={exception}
        level={parentException ? 1 : 0}
        firstChild
        link={false}
        onExceptionClick={onExceptionClick}
      />
      {childExceptions.map((childException, i) => (
        <ExceptionTreeItem
          key={childException.mechanism?.exception_id}
          exception={childException}
          level={parentException ? 2 : 1}
          firstChild={i === 0}
          onExceptionClick={onExceptionClick}
        />
      ))}
    </StyledPre>
  );
}

export function RelatedExceptions({
  allExceptions,
  mechanism,
  newestFirst,
  onExceptionClick,
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
      <ExceptionTree
        {...{parentException, exception, childExceptions, onExceptionClick}}
      />
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
