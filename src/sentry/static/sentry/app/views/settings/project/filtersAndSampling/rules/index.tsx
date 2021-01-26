import React from 'react';
import {
  DragDropContext,
  DragDropContextProps,
  Draggable,
  DragStart,
  DragUpdate,
  Droppable,
  DropResult,
} from 'react-beautiful-dnd';
import styled from '@emotion/styled';

import {PanelTable} from 'app/components/panels';
import {t} from 'app/locale';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

import Placeholder from './placeholder';
import Rule from './rule';
import {getClientY, getDraggedDom, layout} from './utils';

type DragEndChildrenProps = Required<Parameters<DragDropContextProps['onDragEnd']>[0]>;

type Props = {
  rules: Array<DynamicSamplingRule>;
  onEditRule: (rule: DynamicSamplingRule) => () => void;
  onDeleteRule: (rule: DynamicSamplingRule) => () => void;
  onDragEnd: (result: DragEndChildrenProps) => void;
  disabled: boolean;
};

type State = {
  placeholderProps?: {
    clientHeight: number;
    clientWidth: number;
    clientY: number;
    clientX: number;
  };
};

class Rules extends React.Component<Props, State> {
  state: State = {};

  handleDragStart = (initial: DragStart) => {
    const {draggableId, source} = initial;

    const draggedDOM = getDraggedDom(draggableId);

    if (!draggedDOM) {
      return;
    }

    const {clientHeight, clientWidth} = draggedDOM;
    const {index: sourceIndex} = source;

    const domParentNode = draggedDOM.parentNode as Element;

    this.setState({
      placeholderProps: {
        clientHeight,
        clientWidth,
        clientY: getClientY(domParentNode, sourceIndex),
        clientX: parseFloat(window.getComputedStyle(domParentNode).paddingLeft),
      },
    });
  };

  handleDragEnd = (result: DropResult) => {
    // dropped outside the list
    if (!result.destination) {
      return;
    }

    this.props.onDragEnd(result as DragEndChildrenProps);
    this.setState({placeholderProps: undefined});
  };

  handleDragUpdate = (initial: DragUpdate) => {
    const {destination, draggableId, source} = initial;

    if (!destination) {
      return;
    }

    const draggedDOM = getDraggedDom(draggableId);

    if (!draggedDOM) {
      return;
    }

    const {clientHeight, clientWidth} = draggedDOM;
    const {index: destinationIndex} = destination;
    const {index: sourceIndex} = source;
    const domParentNode = draggedDOM.parentNode as Element;

    const childrenArray = [...(domParentNode.children as any)];
    const movedItem = childrenArray[sourceIndex];
    childrenArray.splice(sourceIndex, 1);

    const updatedArray = [
      ...childrenArray.slice(0, destinationIndex),
      movedItem,
      ...childrenArray.slice(destinationIndex + 1),
    ];

    this.setState({
      placeholderProps: {
        clientHeight,
        clientWidth,
        clientY: getClientY(domParentNode, destinationIndex, updatedArray),
        clientX: parseFloat(window.getComputedStyle(domParentNode).paddingLeft),
      },
    });
  };

  render() {
    const {placeholderProps} = this.state;
    const {onEditRule, onDeleteRule, rules, disabled} = this.props;

    return (
      <StyledPanelTable
        headers={['', t('Event Type'), t('Category'), t('Sampling Rate'), '']}
        isEmpty={!rules.length}
        emptyMessage={t('There are no rules to display')}
      >
        <DragDropContext
          onDragStart={this.handleDragStart}
          onDragEnd={this.handleDragEnd}
          onDragUpdate={this.handleDragUpdate}
        >
          <Droppable droppableId="droppable">
            {({innerRef, placeholder, ...props}, {isDraggingOver}) => (
              <List {...props} ref={innerRef}>
                {rules.map((rule, index) => (
                  <Draggable key={rule.id} draggableId={rule.id} index={index}>
                    {(
                      {dragHandleProps, draggableProps, innerRef: innerRefDraggable},
                      {isDragging}
                    ) => (
                      <Rule
                        {...draggableProps}
                        isDragging={isDragging}
                        dragHandle={dragHandleProps}
                        ref={innerRefDraggable}
                        key={index}
                        rule={rule}
                        disabled={disabled}
                        onEditRule={onEditRule(rule)}
                        onDeleteRule={onDeleteRule(rule)}
                      />
                    )}
                  </Draggable>
                ))}
                {placeholder}
                {placeholderProps && isDraggingOver && (
                  <Placeholder
                    top={placeholderProps.clientY}
                    left={placeholderProps.clientX}
                    height={placeholderProps.clientHeight}
                    width={placeholderProps.clientWidth}
                  />
                )}
              </List>
            )}
          </Droppable>
        </DragDropContext>
      </StyledPanelTable>
    );
  }
}

export default Rules;

const List = styled('div')`
  position: relative;
`;

const StyledPanelTable = styled(PanelTable)`
  overflow: visible;
  margin-bottom: 0;
  border: none;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
  ${p => layout(p.theme)}

  > * {
    :nth-child(-n + 6) {
      border-bottom: 1px solid ${p => p.theme.border};
      height: 100%;
    }

    :nth-child(n + 6) {
      ${p =>
        !p.isEmpty
          ? `
              display: grid;
              grid-column: 1/-1;
              padding: 0;
            `
          : `
              display: block;
              grid-column: 1/-1;
            `}
    }
  }
`;
