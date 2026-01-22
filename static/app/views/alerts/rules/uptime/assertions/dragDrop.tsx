import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDndContext,
  useDndMonitor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {restrictToVerticalAxis} from '@dnd-kit/modifiers';

import {Container} from '@sentry/scraps/layout';

import type {LogicalOp, Op} from 'sentry/views/alerts/rules/uptime/types';

import {isAfterOp, moveTo} from './utils';

function isOp(data: unknown): data is Op {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof data.id === 'string' &&
    'op' in data
  );
}

function isDroppableProps(data: unknown): data is DroppableProps {
  return (
    typeof data === 'object' &&
    data !== null &&
    'op' in data &&
    isOp(data.op) &&
    'position' in data &&
    typeof data.position === 'string'
  );
}

export function AssertionsDndContext({children}: {children: React.ReactNode}) {
  const dndSensors = useSensors(useSensor(PointerSensor));

  return (
    <DndContext
      sensors={dndSensors}
      collisionDetection={pointerWithin}
      modifiers={[restrictToVerticalAxis]}
    >
      {children}
    </DndContext>
  );
}
interface DroppableProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled: boolean;
  groupId: string;
  idIndex: number;
  op: Op;
  position: 'before' | 'after' | 'inside';
}

export function DroppableHitbox(props: DroppableProps) {
  const {idIndex, op, groupId, position, disabled, ...rest} = props;

  const {active} = useDndContext();
  const activeData = active?.data.current;
  const activeOp = isOp(activeData) ? activeData : null;

  const dropzoneDisabled =
    disabled ||
    // Do not enable drop areas for the actively dragging node
    activeOp?.id === op.id;

  const {setNodeRef} = useDroppable({
    id: `${groupId}-${idIndex}-${position}`,
    data: props,
    disabled: dropzoneDisabled,
  });

  const isGroup = op.op === 'and' || op.op === 'or' || op.op === 'not';

  const offsetConfig = {
    before: {bottom: isGroup ? 'calc(100% - 10px)' : '50%'},
    after: {top: isGroup ? 'calc(100% - 10px)' : '50%'},
    inside: {inset: '0px', top: '-10px', left: '-12px'},
  };

  const offset = offsetConfig[position];
  const groupHitboxAdjust =
    isGroup && position === 'after' ? {bottom: '-10px', top: 'calc(100%)'} : {};

  return (
    <Container
      ref={setNodeRef}
      position="absolute"
      inset="0px"
      {...offset}
      {...groupHitboxAdjust}
      {...rest}
      style={{pointerEvents: 'none'}}
    />
  );
}

interface DropHandlerProps {
  onChange: (op: LogicalOp) => void;
  rootOp: LogicalOp;
}

/**
 * Drop handler for the root assertion container (should only be rendered
 * once). Monitors the drag-and-drop context as ops are dragged and updates the
 * tree.
 */
export function DropHandler({rootOp, onChange}: DropHandlerProps) {
  useDndMonitor({
    onDragOver(event) {
      const {active, over} = event;

      // the root op should ALWAYS be `and`, but the typing doesn't strictly enforce that
      if (rootOp.op !== 'and') {
        return;
      }

      const activeData = active?.data.current;
      const overData = over?.data.current;

      if (!isOp(activeData) || !isDroppableProps(overData)) {
        return;
      }

      // Do not move if already in the target position
      if (
        overData.position === 'after' &&
        isAfterOp(rootOp, activeData.id, overData.op.id)
      ) {
        return;
      }
      if (
        overData.position === 'before' &&
        isAfterOp(rootOp, overData.op.id, activeData.id)
      ) {
        return;
      }

      onChange(moveTo(rootOp, activeData.id, overData.op.id, overData.position));
    },
  });

  return null;
}
