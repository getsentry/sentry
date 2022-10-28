import get from 'lodash/get';
import set from 'lodash/set';

// TODO: objects need order of nodes, so probably have to use a list
export const parseViewHierarchy = (rawViewHierarchy: string) => {
  // TODO: Only captures the node names right now
  const DEPTH_CHARACTER = /\|/g;
  const NODE_REGEX = /<(\w*:[^;]*).*>/;

  const viewHierarchyNodes: any = {};

  const nodeIndices: string[] = [];
  let currDepth = -1;

  const lines = rawViewHierarchy.split('\n');
  lines.forEach(line => {
    const nodeTitle = line.match(NODE_REGEX)![1];
    const nodeDepth = line.match(DEPTH_CHARACTER)?.length ?? 0;

    if (nodeDepth === currDepth) {
      nodeIndices.pop();
      nodeIndices.push(nodeTitle);
    } else if (nodeDepth > currDepth) {
      nodeIndices.push(nodeTitle);
      currDepth = currDepth + 1;
    } else if (nodeDepth < currDepth) {
      nodeIndices.pop();
      nodeIndices.pop();
      nodeIndices.push(nodeTitle);
      currDepth = currDepth - 1;
    }

    // console.log(JSON.stringify(viewHierarchyNodes, null, 2) + '\n');
    set(viewHierarchyNodes, nodeIndices, {
      ...get(viewHierarchyNodes, nodeIndices),
    });
    // console.log(nodeTitle, nodeDepth, nodeIndices);
    // console.log(JSON.stringify(viewHierarchyNodes, null, 2) + '\n');
    // console.log('**********');
  });

  // process.stdout.write(JSON.stringify(viewHierarchyNodes, null, 2) + '\n');
  return viewHierarchyNodes;
};
