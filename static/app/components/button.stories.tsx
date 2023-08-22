import {Button} from 'sentry/components/button';
import Matrix from 'sentry/components/stories/matrix';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import {describe} from 'sentry/components/stories/story';
import {IconDelete} from 'sentry/icons';

export default describe('Button', story => {
  story('default', () => <Button priority="default">Default Button</Button>);

  story('Size', () =>
    ['md' as const, 'sm' as const, 'xs' as const, 'zero' as const].map(size => (
      <Button key={size} size={size}>
        {size}
      </Button>
    ))
  );

  story('Priority', () =>
    ['default' as const, 'primary' as const, 'danger' as const, 'link' as const].map(
      priority => (
        <Button key={priority} priority={priority}>
          {priority}
        </Button>
      )
    )
  );

  story('Props', () => (
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
  ));
});

// export default function Main() {
//   return (
//     <SizingWindow>
//       <Button priority="default">Default Button</Button>
//     </SizingWindow>
//   );
// }

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
