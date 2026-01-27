import type {CSSProperties} from 'react';
import {useTheme} from '@emotion/react';

import type {Assertion} from 'sentry/views/alerts/rules/uptime/types';

import {Tree} from './models/tree';
import type {Connector} from './models/treeNode';

const ROW_HEIGHT_PX = 24;
const INDENT_PX = 24;
const CONNECTOR_THICKNESS_PX = 1;
const DEPTH_OFFSET_PX = 10;
const CONTENT_PADDING_PX = 10;

function leftOffsetFromLevel(level: number): number {
  return (
    level * INDENT_PX +
    Math.floor(INDENT_PX / 2) +
    level * DEPTH_OFFSET_PX +
    level * CONTENT_PADDING_PX
  );
}

function ConnectorLine({
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
  const theme = useTheme();

  const midY = Math.floor(ROW_HEIGHT_PX / 2);
  const isImmediateParentLevel = connector.level === nodeDepth - 1;

  const box =
    connector.type === 'vertical'
      ? {
          left: leftOffsetFromLevel(connector.level),
          top: 0,
          width: CONNECTOR_THICKNESS_PX,
          height: isImmediateParentLevel && isLastChild ? midY : ROW_HEIGHT_PX,
        }
      : {
          left: leftOffsetFromLevel(connector.level),
          top: midY,
          width: INDENT_PX,
          height: CONNECTOR_THICKNESS_PX,
        };

  const style: CSSProperties = {
    position: 'absolute',
    left: box.left,
    top: rowTop + box.top,
    width: box.width,
    height: box.height,
    background: theme.tokens.content.primary,
  };

  return <div style={style} />;
}

export function AssertionFailureTree({assertion}: {assertion: Assertion}) {
  const tree = Tree.FromAssertion(assertion);

  return (
    <div
      style={{
        position: 'relative',
        height: tree.nodes.length * ROW_HEIGHT_PX,
        width: '100%',
      }}
    >
      {/* connectors layer */}
      {tree.nodes.flatMap((node, idx) => {
        const rowTop = idx * ROW_HEIGHT_PX;
        return node.connectors.map((connector, connectorIdx) => (
          <ConnectorLine
            key={`${node.value.id}-connector-${connectorIdx}`}
            connector={connector}
            rowTop={rowTop}
            nodeDepth={node.depth}
            isLastChild={node.isLastChild}
          />
        ));
      })}

      {/* rows layer */}
      {tree.nodes.map((node, idx) => {
        const rowTop = idx * ROW_HEIGHT_PX;
        // Start content after the horizontal connector ends (+ padding), so the
        // gap between connector and row stays constant even with depth offsets.
        const paddingLeft =
          node.depth === 0
            ? 0
            : leftOffsetFromLevel(node.depth - 1) + INDENT_PX + CONTENT_PADDING_PX;

        return (
          <div
            key={node.value.id}
            style={{
              position: 'absolute',
              top: rowTop,
              left: 0,
              right: 0,
              height: ROW_HEIGHT_PX,
              display: 'flex',
              alignItems: 'center',
              paddingLeft,
            }}
          >
            {node.renderRow()}
          </div>
        );
      })}
    </div>
  );
}
