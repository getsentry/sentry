import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import type {ExceptionValue} from 'sentry/types/event';
import {defined} from 'sentry/utils';

export type HiddenExceptionsState = Record<number, boolean>;

/**
 * Manages collapse/expand state for exception group hierarchies.
 * Non-root exception groups (those with a parent_id) start with their
 * children hidden. Users can toggle visibility or click a link in the
 * related exceptions tree to reveal a specific branch.
 */
export function useHiddenExceptions(values: ExceptionValue[]) {
  const [hiddenExceptions, setHiddenExceptions] = useState<HiddenExceptionsState>(() =>
    values
      .filter(
        ({mechanism}) => mechanism?.is_exception_group && defined(mechanism.parent_id)
      )
      .reduce<HiddenExceptionsState>(
        (acc, next) => ({...acc, [next.mechanism?.exception_id ?? -1]: true}),
        {}
      )
  );

  const toggleRelatedExceptions = useCallback((exceptionId: number) => {
    setHiddenExceptions(old => {
      if (!defined(old[exceptionId])) {
        return old;
      }
      return {...old, [exceptionId]: !old[exceptionId]};
    });
  }, []);

  const expandException = useCallback(
    (exceptionId: number) => {
      setHiddenExceptions(old => {
        const exceptionValue = values.find(
          value => value.mechanism?.exception_id === exceptionId
        );
        const exceptionGroupId = exceptionValue?.mechanism?.parent_id;
        if (!defined(exceptionGroupId) || !defined(old[exceptionGroupId])) {
          return old;
        }
        return {...old, [exceptionGroupId]: false};
      });
    },
    [values]
  );

  return {hiddenExceptions, toggleRelatedExceptions, expandException};
}

function getExceptionName(exception: ExceptionValue) {
  if (exception.type) {
    return exception.value ? `${exception.type}: ${exception.value}` : exception.type;
  }
  return exception.value ?? t('Exception');
}

interface ToggleRelatedExceptionsButtonProps {
  exception: ExceptionValue;
  hiddenExceptions: HiddenExceptionsState;
  toggleRelatedExceptions: (exceptionId: number) => void;
  values: ExceptionValue[];
}

export function ToggleRelatedExceptionsButton({
  exception,
  hiddenExceptions,
  toggleRelatedExceptions,
  values,
}: ToggleRelatedExceptionsButtonProps) {
  const exceptionId = exception.mechanism?.exception_id;
  if (!defined(exceptionId) || !defined(hiddenExceptions[exceptionId])) {
    return null;
  }

  const collapsed = hiddenExceptions[exceptionId];
  const numChildren = values.filter(
    ({mechanism}) => mechanism?.parent_id === exceptionId
  ).length;

  return (
    <MonoButton
      priority="link"
      size="xs"
      onClick={() => toggleRelatedExceptions(exceptionId)}
      data-test-id="toggle-related-exceptions"
    >
      {collapsed
        ? tn('Show %s related exception', 'Show %s related exceptions', numChildren)
        : tn('Hide %s related exception', 'Hide %s related exceptions', numChildren)}
    </MonoButton>
  );
}

const MonoButton = styled(Button)`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
`;

interface RelatedExceptionsTreeProps {
  allExceptions: ExceptionValue[];
  exception: ExceptionValue;
  newestFirst: boolean;
  onExceptionClick: (exceptionId: number) => void;
}

export function RelatedExceptionsTree({
  exception,
  allExceptions,
  newestFirst,
  onExceptionClick,
}: RelatedExceptionsTreeProps) {
  const mechanism = exception.mechanism;
  if (!mechanism?.is_exception_group) {
    return null;
  }

  const parentException = allExceptions.find(
    exc => exc.mechanism?.exception_id === mechanism.parent_id
  );
  const currentException = allExceptions.find(
    exc => exc.mechanism?.exception_id === mechanism.exception_id
  );
  const childExceptions = allExceptions.filter(
    exc => exc.mechanism?.parent_id === mechanism.exception_id
  );

  if (newestFirst) {
    childExceptions.reverse();
  }

  if (!currentException) {
    return null;
  }

  return (
    <Flex direction="column" gap="xs" data-test-id="related-exceptions-tree">
      <Text variant="muted" size="sm" bold>
        {t('Related Exceptions')}
      </Text>
      <TreePre>
        {parentException && (
          <ExceptionTreeItem
            exception={parentException}
            level={0}
            onExceptionClick={onExceptionClick}
          />
        )}
        <ExceptionTreeItem
          exception={currentException}
          level={parentException ? 1 : 0}
          firstChild
          link={false}
          onExceptionClick={onExceptionClick}
        />
        {childExceptions.map((child, i) => (
          <ExceptionTreeItem
            key={child.mechanism?.exception_id}
            exception={child}
            level={parentException ? 2 : 1}
            firstChild={i === 0}
            onExceptionClick={onExceptionClick}
          />
        ))}
      </TreePre>
    </Flex>
  );
}

function ExceptionTreeItem({
  exception,
  level,
  firstChild,
  link = true,
  onExceptionClick,
}: {
  exception: ExceptionValue;
  level: number;
  onExceptionClick: (exceptionId: number) => void;
  firstChild?: boolean;
  link?: boolean;
}) {
  const exceptionId = exception.mechanism?.exception_id;
  const name = getExceptionName(exception);

  return (
    <TreeItem level={level} data-test-id="exception-tree-item">
      {level > 0 && <TreeChildLine firstChild={firstChild} />}
      <Circle />
      {link && defined(exceptionId) ? (
        <Button
          priority="link"
          size="zero"
          onClick={() => {
            onExceptionClick(exceptionId);
            setTimeout(() => {
              document
                .getElementById(`exception-${exceptionId}`)
                ?.scrollIntoView?.({behavior: 'smooth', block: 'center'});
            }, 0);
          }}
        >
          {name}
        </Button>
      ) : (
        <div>{name}</div>
      )}
    </TreeItem>
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

const TreePre = styled('pre')`
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
  gap: ${p => p.theme.space.md};
  padding-left: ${p => (p.level > 0 ? 20 : 0)}px;
  margin-left: ${p => Math.max((p.level - 1) * 20, 0)}px;
  height: 24px;
  white-space: nowrap;
`;

const Circle = styled('div')`
  border-radius: 50%;
  height: 12px;
  width: 12px;
  border: 1px solid ${p => p.theme.tokens.border.primary};
`;
