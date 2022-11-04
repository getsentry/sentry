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

  const prevNodes: Node[] = [];
  let currNode: Node | undefined = undefined;

  let currDepth = 0;
  const lines = rawViewHierarchy.split('\n');
  const result = lines.reduce(
    (viewHierarchyNodes, line) => {
      const nodeTitle = line.match(NODE_REGEX)![1];
      const nodeDepth = line.match(DEPTH_CHARACTER)?.length ?? 0;

      const nextNode = {
        title: nodeTitle,
        children: [],
        // meta: {},
      };
      if (!currNode) {
        console.log('init', nodeTitle);
        // Set the first node
        viewHierarchyNodes = nextNode;
        currNode = viewHierarchyNodes;
      } else if (nodeDepth > currDepth) {
        console.log('push', nodeTitle, 'onto', currNode.title);
        // The current node goes into the stack
        prevNodes.push(currNode);

        // If we go down a level, add this node
        currNode.children.push(nextNode);

        // We follow the node and update our depth
        currNode = nextNode;
        currDepth = currDepth + 1;
      } else if (nodeDepth < currDepth) {
        console.log('pop', nodeTitle);
        const delta = currDepth - nodeDepth;
        // We need to go up one level, pop the last node to add to
        for (let i = 0; i <= delta; i++) {
          currNode = prevNodes.pop();
          console.log('popped', currNode.title);
          currDepth = currDepth - 1;
        }

        // Add the new node
        currNode.children.push(nextNode);
        console.log('add', nodeTitle, 'onto', currNode.title);

        // prevNodes.push(currNode);
        currNode = nextNode;
      } else if (nodeDepth === currDepth) {
        console.log('same', nodeTitle);
        // Not advancing any levels
        currNode = prevNodes.pop();
        console.log('same adding', nodeTitle, 'to', currNode.title);
        currNode?.children.push(nextNode);
        prevNodes.push(currNode);
        currNode = nextNode;
      }
      // console.log(JSON.stringify(viewHierarchyNodes, null, 2) + '\n');
      // console.log('**********');

      return viewHierarchyNodes;
    },
    {title: '', children: []}
  );
  console.log(JSON.stringify(result, null, 2) + '\n');
  return result;
};
