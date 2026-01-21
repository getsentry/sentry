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
  const activeOp = active?.data.current as Op | null;

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

      if (!active?.data.current || !over?.data.current) {
        return;
      }

      const activeOp = active.data.current as Op;
      const overProps = over.data.current as DroppableProps;

      // Do not move to something it's already immediately after
      if (
        isAfterOp(rootOp, activeOp.id, overProps.op.id) &&
        overProps.position === 'after'
      ) {
        return;
      }

      onChange(moveTo(rootOp, activeOp.id, overProps.op.id, overProps.position));
    },
  });

  return null;
}
