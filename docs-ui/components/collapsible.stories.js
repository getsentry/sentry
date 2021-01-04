import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {number} from '@storybook/addon-knobs';

import Button from 'app/components/button';
import Collapsible from 'app/components/collapsible';
import {tn} from 'app/locale';

export default {
  title: 'Utilities/Collapsible',
};

export const Default = withInfo(
  'This component is used to show first X items and collapse the rest'
)(() => {
  return (
    <Collapsible maxVisibleItems={number('Max visible items', 5)}>
      {[1, 2, 3, 4, 5, 6, 7].map(item => (
        <div key={item}>Item {item}</div>
      ))}
    </Collapsible>
  );
});

export const CustomButtons = () => {
  return (
    <Collapsible
      maxVisibleItems={number('Max visible items', 5)}
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
