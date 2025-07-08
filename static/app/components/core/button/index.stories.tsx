import {useTheme} from '@emotion/react';

import {Button, type ButtonProps} from 'sentry/components/core/button';
import {IconDelete} from 'sentry/icons';
import * as Storybook from 'sentry/stories';

import types from '!!type-loader!sentry/components/core/button';

export default Storybook.story('Button', (story, APIReference) => {
  APIReference(types.Button);

  story('Default', () => {
    const theme = useTheme();
    const variants = theme.isChonk
      ? ['default', 'transparent', 'primary', 'warning', 'danger', 'link']
      : ['default', 'transparent', 'primary', 'link', 'danger'];

    const propMatrix: Storybook.PropMatrix<ButtonProps> = {
      children: ['Delete', undefined],
      icon: [undefined, <IconDelete key="delete" />],
      priority: variants as Array<ButtonProps['priority']>,
      size: ['md', 'sm', 'xs', 'zero'],
      disabled: [false, true],
      title: [undefined, 'Delete this'],
    };

    return (
      <div>
        <Storybook.PropMatrix<ButtonProps>
          render={Button}
          propMatrix={propMatrix}
          selectedProps={['size', 'priority']}
        />
        <Storybook.PropMatrix<ButtonProps>
          render={Button}
          propMatrix={propMatrix}
          selectedProps={['children', 'icon']}
        />
        <Storybook.PropMatrix<ButtonProps>
          render={Button}
          propMatrix={propMatrix}
          selectedProps={['priority', 'disabled']}
        />
      </div>
    );
  });
});
