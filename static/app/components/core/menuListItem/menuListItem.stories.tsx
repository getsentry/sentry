import documentation from '!!type-loader!sentry/components/core/menuListItem';
import styled from '@emotion/styled';

import {MenuListItem} from 'sentry/components/core/menuListItem/index';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

export default Storybook.story('MenuListItem', (story, APIReference) => {
  APIReference(documentation.props?.MenuListItem);

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

  story('with details', () => {
    return (
      <SizeVariants details="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." />
    );
  });
});

const Container = styled('div')`
  margin-top: ${space(0.5)};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;

const leadingItems: React.ComponentProps<typeof MenuListItem>['leadingItems'] = state => {
  return state.isSelected ? '✅' : '⬜';
};

function SizeVariants(props: Partial<React.ComponentProps<typeof MenuListItem>>) {
  return (
    <Storybook.Grid>
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
    </Storybook.Grid>
  );
}
