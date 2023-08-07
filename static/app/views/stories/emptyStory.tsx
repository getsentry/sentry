import {ComponentProps} from 'react';

import SizingWindow from 'sentry/components/stories/sizingWindow';

interface Props extends ComponentProps<'div'> {}

export default function EmptyStory({style}: Props) {
  return (
    <SizingWindow style={style}>
      <strong>Nothing is selected</strong>
    </SizingWindow>
  );
}
