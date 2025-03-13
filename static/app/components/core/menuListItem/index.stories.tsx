import styled from '@emotion/styled';

import {MenuListItem} from 'sentry/components/core/menuListItem/index';
import {Grid} from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/menuListItem';

export default storyBook('MenuListItem', (story, APIReference) => {
  APIReference(types.MenuListItem);

  story('focused', () => {
    return <SizeVariants isFocused />;
  });

  story('selected', () => {
    return <SizeVariants isSelected priority="primary" />;
  });

  story('focused & selected', () => {
    return <SizeVariants isFocused isSelected priority="primary" />;
  });

  story('disabled', () => {
    return <SizeVariants disabled />;
  });

  story('with trailing items', () => {
    return <SizeVariants trailingItems="🚀" />;
  });
});

const Container = styled('div')`
  margin-top: ${space(0.5)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const leadingItems: React.ComponentProps<typeof MenuListItem>['leadingItems'] = state => {
  return state.isSelected ? '✅' : '⬜';
};

function SizeVariants(props: Partial<React.ComponentProps<typeof MenuListItem>>) {
  return (
    <Grid>
      <div>
        Medium:
        <Container>
          <MenuListItem size="md" label="hello" leadingItems={leadingItems} />
          <MenuListItem size="md" label="sentry" leadingItems={leadingItems} {...props} />
          <MenuListItem size="md" label="world" leadingItems={leadingItems} />
        </Container>
      </div>
      <div>
        Small:
        <Container>
          <MenuListItem size="sm" label="hello" leadingItems={leadingItems} />
          <MenuListItem size="sm" label="sentry" leadingItems={leadingItems} {...props} />
          <MenuListItem size="sm" label="world" leadingItems={leadingItems} />
        </Container>
      </div>
      <div>
        X-Small:
        <Container>
          <MenuListItem size="xs" label="hello" leadingItems={leadingItems} />
          <MenuListItem size="xs" label="sentry" leadingItems={leadingItems} {...props} />
          <MenuListItem size="xs" label="world" leadingItems={leadingItems} />
        </Container>
      </div>
    </Grid>
  );
}
