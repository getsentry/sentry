import {Fragment, useState} from 'react';

import {Button} from 'sentry/components/button';
import Matrix from 'sentry/components/stories/matrix';
import {IconDelete} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(Button, story => {
  const sizes = ['md' as const, 'sm' as const, 'xs' as const, 'zero' as const];
  const priorities = [
    'default' as const,
    'primary' as const,
    'danger' as const,
    'link' as const,
  ];

  story('Default', () => <Button>Default Button</Button>);

  story('onClick', () => {
    const [clickCount, setClickCount] = useState(0);
    return (
      <Fragment>
        <p>clicked = {clickCount}</p>
        <Button onClick={() => setClickCount(prev => ++prev)}>Click Here</Button>
      </Fragment>
    );
  });

  const propMatrix = {
    borderless: [false, true],
    busy: [false, true],
    children: ['Save', undefined],
    icon: [undefined, <IconDelete key="" />],
    priority: priorities,
    size: sizes,
    disabled: [false, true],
    external: [false, true],
    title: [undefined, 'Save Now'],
    translucentBorder: [false, true],
  };
  story('Props', () => (
    <div>
      <Matrix<typeof Button>
        render={Button}
        propMatrix={propMatrix}
        selectedProps={['priority', 'size']}
      />
      <Matrix<typeof Button>
        render={Button}
        propMatrix={propMatrix}
        selectedProps={['children', 'icon']}
      />
      <Matrix<typeof Button>
        render={Button}
        propMatrix={propMatrix}
        selectedProps={['borderless', 'translucentBorder']}
      />
      <Matrix<typeof Button>
        render={Button}
        propMatrix={propMatrix}
        selectedProps={['disabled', 'busy']}
      />
    </div>
  ));
});
