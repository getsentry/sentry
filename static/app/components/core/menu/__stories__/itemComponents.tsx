import {IconCircle} from '@sentry/icons/circle';
import {IconCircleCheckmark} from '@sentry/icons/circleCheckmark';

import {Container} from '@sentry/scraps/layout';
import {Menu} from '@sentry/scraps/menu';

import * as Storybook from 'sentry/stories';

type ItemState = {disabled: boolean; isFocused: boolean; isSelected: boolean};

const leadingItems = ({isSelected}: ItemState) =>
  isSelected ? (
    <IconCircleCheckmark aria-hidden variant="accent" />
  ) : (
    <IconCircle aria-hidden />
  );

export function StatesDemo() {
  return (
    <Storybook.Grid>
      <div>
        Focused:
        <Container>
          <Menu.ListItems label="hello" leadingItems={leadingItems} />
          <Menu.ListItems label="sentry" leadingItems={leadingItems} isFocused />
          <Menu.ListItems label="world" leadingItems={leadingItems} />
        </Container>
      </div>
      <div>
        Selected:
        <Container>
          <Menu.ListItems label="hello" leadingItems={leadingItems} />
          <Menu.ListItems label="sentry" leadingItems={leadingItems} isSelected />
          <Menu.ListItems label="world" leadingItems={leadingItems} />
        </Container>
      </div>
      <div>
        Disabled:
        <Container>
          <Menu.ListItems label="hello" leadingItems={leadingItems} />
          <Menu.ListItems label="sentry" leadingItems={leadingItems} disabled />
          <Menu.ListItems label="world" leadingItems={leadingItems} />
        </Container>
      </div>
    </Storybook.Grid>
  );
}

export function TrailingDemo() {
  return (
    <Container>
      <Menu.ListItems
        label="Item with badge"
        leadingItems={leadingItems}
        trailingItems="🚀"
      />
      <Menu.ListItems
        label="Another item"
        leadingItems={leadingItems}
        trailingItems="⭐"
      />
    </Container>
  );
}

export function DetailsDemo() {
  return (
    <Container>
      <Menu.ListItems
        label="Option with details"
        details="This is additional information about the option"
        leadingItems={leadingItems}
      />
      <Menu.ListItems
        label="Another option"
        details="More helpful context here"
        leadingItems={leadingItems}
      />
    </Container>
  );
}
