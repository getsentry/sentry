import type {MouseEventHandler} from 'react';

import {Button} from 'sentry/components/core/button';
import {IconAdd} from 'sentry/icons';

interface Props {
  onAdd: MouseEventHandler<Element>;
  title: string;
}

export function AddButton({title, onAdd}: Props) {
  return (
    <Button size="sm" redesign onClick={onAdd} icon={<IconAdd isCircled redesign />}>
      {title}
    </Button>
  );
}
