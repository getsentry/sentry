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
          <Menu.ListItem label="hello" leadingItems={leadingItems} />
          <Menu.ListItem label="sentry" leadingItems={leadingItems} isFocused />
          <Menu.ListItem label="world" leadingItems={leadingItems} />
        </Container>
      </div>
      <div>
        Selected:
        <Container>
          <Menu.ListItem label="hello" leadingItems={leadingItems} />
          <Menu.ListItem label="sentry" leadingItems={leadingItems} isSelected />
          <Menu.ListItem label="world" leadingItems={leadingItems} />
        </Container>
      </div>
      <div>
        Disabled:
        <Container>
          <Menu.ListItem label="hello" leadingItems={leadingItems} />
          <Menu.ListItem label="sentry" leadingItems={leadingItems} disabled />
          <Menu.ListItem label="world" leadingItems={leadingItems} />
        </Container>
      </div>
    </Storybook.Grid>
  );
}

export function TrailingDemo() {
  return (
    <Container>
      <Menu.ListItem
        label="Item with badge"
        leadingItems={leadingItems}
        trailingItems="🚀"
      />
      <Menu.ListItem
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
      <Menu.ListItem
        label="Option with details"
        details="This is additional information about the option"
        leadingItems={leadingItems}
      />
      <Menu.ListItem
        label="Another option"
        details="More helpful context here"
        leadingItems={leadingItems}
      />
    </Container>
  );
}
