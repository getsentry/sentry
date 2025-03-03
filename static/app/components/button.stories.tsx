import {Fragment, useState} from 'react';

import type {ButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import type {PropMatrix} from 'sentry/components/stories/matrix';
import Matrix from 'sentry/components/stories/matrix';
import {IconDelete} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/button';

export default storyBook('Button', (story, APIReference) => {
  APIReference(types.Button);

  story('Default', () => {
    return <Button>Default Button</Button>;
  });

  story('onClick', () => {
    const [clickCount, setClickCount] = useState(0);
    return (
      <Fragment>
        <p>clicked = {clickCount}</p>
        <Button onClick={() => setClickCount(prev => ++prev)}>Click Here</Button>
      </Fragment>
    );
  });

  const propMatrix: PropMatrix<ButtonProps> = {
    borderless: [false, true],
    busy: [false, true],
    children: ['Delete', undefined],
    icon: [undefined, <IconDelete key="" />],
    priority: ['default', 'primary', 'danger', 'link', undefined],
    size: ['md', 'sm', 'xs', 'zero'],
    disabled: [false, true],
    external: [false, true],
    title: [undefined, 'Delete this'],
    translucentBorder: [false, true],
  };
  story('Props', () => (
    <div>
      <Matrix<ButtonProps>
        render={Button}
        propMatrix={propMatrix}
        selectedProps={['priority', 'size']}
      />
      <Matrix<ButtonProps>
        render={Button}
        propMatrix={propMatrix}
        selectedProps={['children', 'icon']}
      />
      <Matrix<ButtonProps>
        render={Button}
        propMatrix={propMatrix}
        selectedProps={['size', 'icon']}
      />
      <Matrix<ButtonProps>
        render={Button}
        propMatrix={propMatrix}
        selectedProps={['borderless', 'translucentBorder']}
      />
      <Matrix<ButtonProps>
        render={Button}
        propMatrix={propMatrix}
        selectedProps={['disabled', 'busy']}
      />
    </div>
  ));
});
