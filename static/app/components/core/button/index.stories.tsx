import {useTheme} from '@emotion/react';

import {Button, type ButtonProps} from 'sentry/components/core/button';
import Matrix, {type PropMatrix} from 'sentry/components/stories/matrix';
import {IconDelete} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/button';

export default storyBook('Button', (story, APIReference) => {
  APIReference(types.Button);

  story('Default', () => {
    const theme = useTheme();
    const variants = theme.isChonk
      ? ['default', 'transparent', 'primary', 'warning', 'danger', 'link']
      : ['default', 'primary', 'link', 'danger'];

    const propMatrix: PropMatrix<ButtonProps> = {
      borderless: [false, true],
      busy: [false, true],
      children: ['Delete', undefined],
      icon: [undefined, <IconDelete key="delete" />],
      priority: variants as Array<ButtonProps['priority']>,
      size: ['md', 'sm', 'xs', 'zero'],
      disabled: [false, true],
      external: [false, true],
      title: [undefined, 'Delete this'],
      translucentBorder: [false, true],
    };

    return (
      <div>
        <Matrix<ButtonProps>
          render={Button}
          propMatrix={propMatrix}
          selectedProps={['size', 'priority']}
        />
        <Matrix<ButtonProps>
          render={Button}
          propMatrix={propMatrix}
          selectedProps={['children', 'icon']}
        />
      </div>
    );
  });
});
