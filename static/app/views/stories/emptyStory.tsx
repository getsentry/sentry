import {ComponentProps} from 'react';

interface Props extends ComponentProps<'div'> {}

export default function EmptyStory({style}: Props) {
  return (
    <div style={style}>
      <strong>Nothing is selected</strong>
    </div>
  );
}
