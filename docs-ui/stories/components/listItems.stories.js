import range from 'lodash/range';

import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {listSymbol} from 'sentry/components/list/utils';

export default {
  title: 'Components/List',
  argTypes: {
    symbol: {
      options: Object.keys(listSymbol),
      control: {type: 'radio'},
    },
  },
};

export const _List = ({...args}) => {
  const items = range(0, 10);
  return (
    <List {...args}>
      {items.map(x => (
        <ListItem key={x}>Item {x + 1}</ListItem>
      ))}
    </List>
  );
};
