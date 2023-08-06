import {Button} from 'sentry/components/button';
import SizingWindow from 'sentry/components/stories/sizingWindow';

export default function Main() {
  return (
    <SizingWindow>
      <Button priority="default">Default Button</Button>
    </SizingWindow>
  );
}

export function Priority() {
  return (
    <SizingWindow>
      <Button priority="default">Default</Button>
      <Button priority="primary">Primary</Button>
      <Button priority="danger">Danger</Button>
      <Button priority="link">Link</Button>
    </SizingWindow>
  );
}

export function Size() {
  return (
    <SizingWindow>
      <Button size="zero">zero</Button>
      <Button size="xs">xs</Button>
      <Button size="sm">sm</Button>
      <Button size="md">md</Button>
    </SizingWindow>
  );
}
