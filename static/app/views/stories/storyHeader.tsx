import {ComponentProps} from 'react';

interface Props extends ComponentProps<'div'> {}

export default function StoryHeader({style}: Props) {
  return (
    <div style={style}>
      <h1>Sentry Component Stories</h1>
    </div>
  );
}
