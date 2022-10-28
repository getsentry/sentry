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

  let currDepth = 0;

  const prevNodes: Node[] = [];
  let currNode: Node | undefined = undefined;

  const lines = rawViewHierarchy.split('\n');
  return lines.reduce(
    (viewHierarchyNodes, line) => {
      const nodeTitle = line.match(NODE_REGEX)![1];
      const nodeDepth = line.match(DEPTH_CHARACTER)?.length ?? 0;

      const nextNode = {
        title: nodeTitle,
        children: [],
        // meta: {},
      };
      console.log(
        `title[${nodeTitle}]`,
        `current line depth[${nodeDepth}]`,
        `overall depth[${currDepth}]`
      );
      console.log(prevNodes.map(node => node.title));
      if (!currNode) {
        // Set the first node
        viewHierarchyNodes = nextNode;
        currNode = viewHierarchyNodes;
      } else if (nodeDepth > currDepth) {
        // If we go down a level, add this node
        currNode.children.push(nextNode);

        // The current node goes into the stack
        console.log('push A');
        prevNodes.push(currNode);

        // We follow the node and update our depth
        currNode = nextNode;
        currDepth = currDepth + 1;
      } else if (nodeDepth < currDepth) {
        // We need to go up one level, pop the last node to add to
        currNode = prevNodes.pop();
        currDepth = currDepth - 1;

        // Add the new node
        currNode?.children.push(nextNode);
        currNode = nextNode;
      } else if (nodeDepth === currDepth) {
        // Not advancing any levels
        console.log('equal');
        const prevNode = prevNodes.pop();
        currNode = prevNode;
        currNode.children.push(nextNode);
        currNode = nextNode;
        prevNodes.push(prevNode);
      }
      console.log(JSON.stringify(viewHierarchyNodes, null, 2) + '\n');
      console.log('**********');

      return viewHierarchyNodes;
    },
    {title: '', children: []}
  );
};
