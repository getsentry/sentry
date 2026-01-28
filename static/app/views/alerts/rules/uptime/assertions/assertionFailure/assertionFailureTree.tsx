import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

import type {Assertion} from 'sentry/views/alerts/rules/uptime/types';

import {Tree} from './models/tree';
import type {Connector} from './models/treeNode';

const ROW_HEIGHT_PX = 24;
const INDENT_PX = 24;
const CONNECTOR_THICKNESS_PX = 1;
const DEPTH_OFFSET_PX = 10;
const CONTENT_PADDING_PX = 8;

function leftOffsetFromDepth(depth: number): number {
  return (
    depth * INDENT_PX +
    Math.floor(INDENT_PX / 2) +
    depth * DEPTH_OFFSET_PX +
    depth * CONTENT_PADDING_PX
  );
}

function Connector({
  connector,
  rowTop,
  nodeDepth,
  isLastChild,
}: {
  connector: Connector;
  isLastChild: boolean;
  nodeDepth: number;
  rowTop: number;
}) {
  const midY = Math.floor(ROW_HEIGHT_PX / 2);
  const isImmediateParentLevel = connector.depth === nodeDepth - 1;

  const box =
    connector.type === 'vertical'
      ? {
          left: leftOffsetFromDepth(connector.depth),
          top: 0,
          width: CONNECTOR_THICKNESS_PX,
          height: isImmediateParentLevel && isLastChild ? midY : ROW_HEIGHT_PX,
        }
      : {
          left: leftOffsetFromDepth(connector.depth),
          top: midY,
          width: INDENT_PX,
          height: CONNECTOR_THICKNESS_PX,
        };

  return (
    <ConnectorLine
      left={box.left}
      top={rowTop + box.top}
      width={box.width}
      height={box.height}
    />
  );
}

export function AssertionFailureTree({assertion}: {assertion: Assertion}) {
  const tree = Tree.FromAssertion(assertion);

  return (
    <Container
      position="relative"
      height={`${tree.nodes.length * ROW_HEIGHT_PX}px`}
      width="100%"
    >
      {tree.nodes.flatMap((node, idx) => {
        const rowTop = idx * ROW_HEIGHT_PX;
        return node.connectors.map((connector, connectorIdx) => (
          <Connector
            key={`${node.value.id}-connector-${connectorIdx}`}
            connector={connector}
            rowTop={rowTop}
            nodeDepth={node.depth}
            isLastChild={node.isLastChild}
          />
        ));
      })}

      {tree.nodes.map((node, idx) => {
        const rowTop = idx * ROW_HEIGHT_PX;

        // Start from the left of the parent column, plus the indent and content padding.
        const rowLeft =
          node.depth === 0
            ? 0
            : leftOffsetFromDepth(node.depth - 1) + INDENT_PX + CONTENT_PADDING_PX;

        return (
          <Flex
            role="assertion-failure-tree-row"
            key={node.value.id}
            position="absolute"
            top={`${rowTop}px`}
            left={`${rowLeft}px`}
            height={`${ROW_HEIGHT_PX}px`}
            width="100%"
            align="center"
            right="0px"
          >
            {node.renderRow()}
          </Flex>
        );
      })}
    </Container>
  );
}

const ConnectorLine = styled('div')<{
  height: number;
  left: number;
  top: number;
  width: number;
}>`
  position: absolute;
  left: ${p => p.left}px;
  top: ${p => p.top}px;
  width: ${p => p.width}px;
  height: ${p => p.height}px;
  background: ${p => p.theme.tokens.content.primary};
`;
