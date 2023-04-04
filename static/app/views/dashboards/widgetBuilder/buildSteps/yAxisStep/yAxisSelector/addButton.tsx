import {MouseEventHandler} from 'react';

import {Button} from 'sentry/components/button';
import {IconAdd} from 'sentry/icons';

interface Props {
  onAdd: MouseEventHandler<Element>;
  title: string;
}

export const AddButton = ({title, onAdd}: Props) => {
  return (
    <Button size="sm" onClick={onAdd} icon={<IconAdd isCircled />}>
      {title}
    </Button>
  );
};
