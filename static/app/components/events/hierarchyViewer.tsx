import {Fragment} from 'react';
import isEmpty from 'lodash/isEmpty';

const Leaf = ({name: string}) => {
  return <div>{name}</div>;
};

const HierarchyViewer = ({tree}) => {
  if (isEmpty(tree)) {
    return <div>leaf</div>;
  }

  return (
    <Fragment>
      {Object.keys(tree).map(node => (
        <HierarchyViewer key={node} tree={tree[node]} />
      ))}
    </Fragment>
  );
};

export default HierarchyViewer;
