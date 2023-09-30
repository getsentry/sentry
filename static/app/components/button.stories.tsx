import {Fragment, useState} from 'react';

import {Button} from 'sentry/components/button';
import Matrix, {PropMatrix} from 'sentry/components/stories/matrix';
import {IconDelete} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('Button', story => {
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

  const propMatrix: PropMatrix<typeof Button> = {
    borderless: [false, true],
    busy: [false, true],
    children: ['Save', undefined],
    icon: [undefined, <IconDelete key="" />],
    priority: ['default', 'primary', 'danger', 'link', undefined],
    size: ['md', 'sm', 'xs', 'zero'],
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
