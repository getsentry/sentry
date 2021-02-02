import React from 'react';

import Button from 'app/components/button';
import Collapsible from 'app/components/collapsible';
import {tn} from 'app/locale';

export default {
  title: 'Utilities/Collapsible',
  component: Collapsible,
};

export const Default = ({...args}) => (
  <Collapsible {...args}>
    {[1, 2, 3, 4, 5, 6, 7].map(item => (
      <div key={item}>Item {item}</div>
    ))}
  </Collapsible>
);

export const CustomButtons = ({...args}) => {
  return (
    <Collapsible
      {...args}
      collapseButton={({onCollapse}) => <Button onClick={onCollapse}>Collapse</Button>}
      expandButton={({onExpand, numberOfCollapsedItems}) => (
        <Button onClick={onExpand}>
          {tn('Expand %s item', 'Expand %s items', numberOfCollapsedItems)}
        </Button>
      )}
    >
      {[1, 2, 3, 4, 5, 6, 7].map(item => (
        <div key={item}>Item {item}</div>
      ))}
    </Collapsible>
  );
};
