import {Button} from 'sentry/components/button';
import Matrix from 'sentry/components/stories/matrix';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import {IconDelete} from 'sentry/icons';
import SideBySide from 'sentry/views/stories/sideBySide';

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
      <SideBySide>
        <Button priority="default">Default</Button>
        <Button priority="primary">Primary</Button>
        <Button priority="danger">Danger</Button>
        <Button priority="link">Link</Button>
      </SideBySide>
    </SizingWindow>
  );
}

export function Size() {
  return (
    <SizingWindow>
      <SideBySide>
        <Button size="md">md</Button>
        <Button size="sm">sm</Button>
        <Button size="xs">xs</Button>
        <Button size="zero">zero</Button>
      </SideBySide>
    </SizingWindow>
  );
}

export function Icon() {
  return (
    <SizingWindow>
      <SideBySide>
        <Button size="md" icon={<IconDelete />} aria-label="Delete" />
        <Button size="sm" icon={<IconDelete />} aria-label="Delete" />
        <Button size="xs" icon={<IconDelete />} aria-label="Delete" />
        <Button size="zero" icon={<IconDelete />} aria-label="Delete" />
      </SideBySide>
    </SizingWindow>
  );
}

export function PropsMatrix() {
  return (
    <Matrix
      component={Button}
      propMatrix={{
        children: ['Save', undefined],
        icon: [undefined, <IconDelete key="" />],
        priority: ['default', 'primary', 'danger', 'link'],
        size: ['md', 'sm', 'xs', 'zero'],
        borderless: [false, true],
      }}
    />
  );
}
