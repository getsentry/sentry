import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, type ButtonProps} from 'sentry/components/core/button';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/button';

export default storyBook('Button', (story, APIReference) => {
  APIReference(types.Button);

  story('Default', () => {
    const theme = useTheme();
    const variants = theme.isChonk
      ? ['default', 'transparent', 'primary', 'warning', 'danger', 'link']
      : ['default', 'primary', 'link', 'danger'];

    return (
      <Grid n={variants.length}>
        {['md', 'sm', 'xs', 'zero'].map(size =>
          variants.map(priority => (
            <Button
              size={size as ButtonProps['size']}
              priority={priority as ButtonProps['priority']}
              key={`${size}-${priority}`}
            >
              Button
            </Button>
          ))
        )}
      </Grid>
    );
  });
});

const Grid = styled('div')<{n: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.n}, 1fr);
  gap: ${space(2)};
`;
