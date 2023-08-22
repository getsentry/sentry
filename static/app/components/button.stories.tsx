import {Button} from 'sentry/components/button';
import Matrix from 'sentry/components/stories/matrix';
import {IconDelete} from 'sentry/icons';
// import SideBySide from 'sentry/components/stories/sideBySide';
// import SizingWindow from 'sentry/components/stories/sizingWindow';
import component from 'sentry/story/component';

export default component('Button', story => {
  const sizes = ['md' as const, 'sm' as const, 'xs' as const, 'zero' as const];
  const priorities = [
    'default' as const,
    'primary' as const,
    'danger' as const,
    'link' as const,
  ];

  story('default', () => <Button priority="default">Default Button</Button>);

  story('Size', () =>
    sizes.map(size => (
      <Button key={size} size={size}>
        {size}
      </Button>
    ))
  );

  story('Priority', () => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(
          priorities.map(priority => (
            <Button key={priority} priority={priority}>
              {priority}
            </Button>
          ))
        );
      }, 100);
    });
  });

  story('Props', () => (
    <Matrix
      component={Button}
      propMatrix={{
        children: ['Save', undefined],
        icon: [undefined, <IconDelete key="" />],
        priority: priorities,
        size: sizes,
        borderless: [false, true],
      }}
    />
  ));
});
