import {Container} from '@sentry/scraps/layout';
import {MenuListItem} from '@sentry/scraps/menuListItem';

import * as Storybook from 'sentry/stories';

type ItemState = {disabled: boolean; isFocused: boolean; isSelected: boolean};

const leadingItems = (state: ItemState) => (state.isSelected ? '✅' : '⬜');

export function StatesDemo() {
  return (
    <Storybook.Grid>
      <div>
        Focused:
        <Container>
          <MenuListItem label="hello" leadingItems={leadingItems} />
          <MenuListItem label="sentry" leadingItems={leadingItems} isFocused />
          <MenuListItem label="world" leadingItems={leadingItems} />
        </Container>
      </div>
      <div>
        Selected:
        <Container>
          <MenuListItem label="hello" leadingItems={leadingItems} />
          <MenuListItem
            label="sentry"
            leadingItems={leadingItems}
            isSelected
            priority="primary"
          />
          <MenuListItem label="world" leadingItems={leadingItems} />
        </Container>
      </div>
      <div>
        Disabled:
        <Container>
          <MenuListItem label="hello" leadingItems={leadingItems} />
          <MenuListItem label="sentry" leadingItems={leadingItems} disabled />
          <MenuListItem label="world" leadingItems={leadingItems} />
        </Container>
      </div>
    </Storybook.Grid>
  );
}

export function TrailingDemo() {
  return (
    <Container>
      <MenuListItem
        label="Item with badge"
        leadingItems={leadingItems}
        trailingItems="🚀"
      />
      <MenuListItem label="Another item" leadingItems={leadingItems} trailingItems="⭐" />
    </Container>
  );
}

export function DetailsDemo() {
  return (
    <Container>
      <MenuListItem
        label="Option with details"
        details="This is additional information about the option"
        leadingItems={leadingItems}
      />
      <MenuListItem
        label="Another option"
        details="More helpful context here"
        leadingItems={leadingItems}
      />
    </Container>
  );
}
