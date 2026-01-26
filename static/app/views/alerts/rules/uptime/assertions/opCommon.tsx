import {useEffect, useRef} from 'react';
import {useDraggable} from '@dnd-kit/core';
import {motion, type MotionProps} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconDelete, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Comparison, Op} from 'sentry/views/alerts/rules/uptime/types';

interface AnimatedOpProps
  extends MotionProps,
    Omit<React.HTMLAttributes<HTMLDivElement>, keyof MotionProps> {
  children: React.ReactNode;
  isDragging: boolean;
  op: Op;
  ref: React.Ref<HTMLDivElement>;
}

export function AnimatedOp({op, isDragging, ...props}: AnimatedOpProps) {
  const wasDraggingRef = useRef(false);

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'grabbing';
      wasDraggingRef.current = true;
    } else if (wasDraggingRef.current) {
      document.body.style.cursor = '';
      wasDraggingRef.current = false;
    }
    return () => {
      if (wasDraggingRef.current) {
        document.body.style.cursor = '';
      }
    };
  }, [isDragging]);

  return (
    <motion.div
      layout="position"
      layoutId={op.id}
      transition={{duration: 0.15}}
      animate={{opacity: isDragging ? 0.5 : 1}}
      {...props}
    />
  );
}

interface OpContainerProps {
  children: React.ReactNode;
  label: React.ReactNode;
  onRemove: () => void;
  op: Op;
  inputId?: string;
  tooltip?: React.ReactNode;
}
export function OpContainer({
  label,
  children,
  tooltip,
  onRemove,
  inputId,
  op,
}: OpContainerProps) {
  const {attributes, setNodeRef, setActivatorNodeRef, listeners, isDragging} =
    useDraggable({
      id: op.id,
      data: op,
    });

  return (
    <Flex direction="column" gap="sm">
      {flexProps => (
        <AnimatedOp op={op} isDragging={isDragging} ref={setNodeRef} {...flexProps}>
          <Flex gap="xs" align="center">
            <Text size="sm" bold>
              <label htmlFor={inputId}>{label}</label>
            </Text>
            <Button
              size="zero"
              borderless
              icon={<IconGrabbable size="xs" />}
              aria-label={t('Reorder assertion')}
              ref={setActivatorNodeRef}
              style={{cursor: 'grab'}}
              {...listeners}
              {...attributes}
            />
            {tooltip && <QuestionTooltip size="xs" title={tooltip} isHoverable />}
          </Flex>
          <Grid columns="1fr max-content" align="center" gap="sm">
            {children}
            <Button
              size="sm"
              borderless
              icon={<IconDelete />}
              aria-label={t('Remove assertion')}
              onClick={onRemove}
            />
          </Grid>
        </AnimatedOp>
      )}
    </Flex>
  );
}

export const COMPARISON_OPTIONS: Array<
  SelectOption<Comparison['cmp']> & {symbol: string}
> = [
  {
    value: 'equals',
    label: t('equal'),
    symbol: '=',
    trailingItems: <Text monospace>=</Text>,
  },
  {
    value: 'not_equal',
    label: t('not equal'),
    symbol: '\u2260',
    trailingItems: <Text monospace>{'\u2260'}</Text>,
  },
  {
    value: 'less_than',
    label: t('less than'),
    symbol: '<',
    trailingItems: <Text monospace>{'<'}</Text>,
  },
  {
    value: 'greater_than',
    label: t('greater than'),
    symbol: '>',
    trailingItems: <Text monospace>{'>'}</Text>,
  },
  {
    value: 'always',
    label: t('present'),
    symbol: '\u22A4',
    trailingItems: <Text monospace>{'\u22A4'}</Text>,
  },
  {
    value: 'never',
    label: t('not present'),
    symbol: '\u2205',
    trailingItems: <Text monospace>{'\u2205'}</Text>,
  },
];
