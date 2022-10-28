import get from 'lodash/get';
import set from 'lodash/set';

type Node = {
  children: Node[];
  title: string;
  meta?: {[key: string]: any};
};

// TODO: objects need order of nodes, so probably have to use a list
export const parseViewHierarchy = (rawViewHierarchy: string): Node => {
  // TODO: Only captures the node names right now
  const DEPTH_CHARACTER = /\|/g;
  const NODE_REGEX = /<(\w*:[^;]*).*>/;

  const nodeIndices: string[] = [];
  let currDepth = 0;

  const prevNodes: Node[] = [];
  let currNode: Node | undefined = undefined;

  const lines = rawViewHierarchy.split('\n');
  return lines.reduce(
    (viewHierarchyNodes, line) => {
      const nodeTitle = line.match(NODE_REGEX)![1];
      const nodeDepth = line.match(DEPTH_CHARACTER)?.length ?? 0;

      // if (nodeDepth === currDepth) {
      //   nodeIndices.pop();
      //   nodeIndices.push(nodeTitle);
      // } else if (nodeDepth > currDepth) {
      //   nodeIndices.push(nodeTitle);
      //   currDepth = currDepth + 1;
      // } else if (nodeDepth < currDepth) {
      //   nodeIndices.pop();
      //   nodeIndices.pop();
      //   nodeIndices.push(nodeTitle);
      //   currDepth = currDepth - 1;
      // }

      // console.log(JSON.stringify(viewHierarchyNodes, null, 2) + '\n');
      // set(viewHierarchyNodes, nodeIndices, {
      //   ...get(viewHierarchyNodes, nodeIndices),
      //   title: nodeTitle,
      //   children: [],
      //   meta: {},
      // });
      const nextNode = {
        title: nodeTitle,
        children: [],
        // meta: {},
      };
      console.log(nodeTitle, currDepth, nodeDepth);
      if (!currNode) {
        viewHierarchyNodes = nextNode;
        currNode = viewHierarchyNodes;
        currDepth = currDepth + 1;
      } else if (nodeDepth > currDepth) {
        currNode.children.push(nextNode);
        prevNodes.push(currNode);
        currNode = nextNode;
        currDepth = currDepth + 1;
      } else if (nodeDepth < currDepth) {
        currNode = prevNodes.pop();
        currNode?.children.push(nextNode);
        currDepth = currDepth - 1;
      } else if (nodeDepth === currDepth) {
        currNode.children.push(nextNode);
      }
      console.log(JSON.stringify(viewHierarchyNodes, null, 2) + '\n');
      console.log('**********');

      return viewHierarchyNodes;
    },
    {title: '', children: []}
  );
};
