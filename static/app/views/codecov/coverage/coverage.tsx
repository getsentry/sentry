import styled from '@emotion/styled';

import {SunburstChart, type SunburstData} from 'sentry/components/charts/sunburstChart';
import {space} from 'sentry/styles/space';

import {data} from './data';

type TreeNode = {
  fullPath: string;
  name: string;
  children?: TreeNode[];
  coverage?: number;
  dir?: boolean;
  value?: number;
};

// ideally this should be done in the backend
function assignDirectoryCoverage(root: TreeNode): number {
  const stack: Array<{childrenProcessed: boolean; node: TreeNode}> = [
    {node: root, childrenProcessed: false},
  ];
  const coverageMap = new Map<TreeNode, number>();

  while (stack.length > 0) {
    const poppedItem = stack[stack.length - 1];

    if (!poppedItem) {
      continue;
    }

    const {node, childrenProcessed} = poppedItem;

    // Base case: file node
    if (!node.dir) {
      coverageMap.set(node, node.coverage || 0);
      stack.pop();
      continue;
    }

    // Empty directory
    if (!node.children?.length) {
      node.coverage = 0;
      coverageMap.set(node, 0);
      stack.pop();
      continue;
    }

    if (childrenProcessed) {
      // Calculate average coverage from children
      const totalCoverage = node.children.reduce(
        (sum, child) => sum + coverageMap.get(child)!,
        0
      );
      node.coverage = Math.floor(totalCoverage / node.children.length);
      coverageMap.set(node, node.coverage);
      stack.pop();
    } else {
      // Push all children to stack
      poppedItem.childrenProcessed = true;
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        if (child) {
          stack.push({node: child, childrenProcessed: false});
        }
      }
    }
  }

  return coverageMap.get(root) ?? 0;
}

assignDirectoryCoverage(data);

export default function CoveragePage() {
  return (
    <LayoutGap>
      <p>Coverage Analytics</p>
      <SunburstChart data={data as unknown as SunburstData} />
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
