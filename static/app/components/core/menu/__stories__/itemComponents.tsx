import {IconCircle} from '@sentry/icons/circle';
import {IconCircleCheckmark} from '@sentry/icons/circleCheckmark';

import {Container} from '@sentry/scraps/layout';
import {Menu} from '@sentry/scraps/menu';

import * as Storybook from 'sentry/stories';

type ItemState = {disabled: boolean; isFocused: boolean; isSelected: boolean};

const leadingItems = ({isSelected}: ItemState) =>
  isSelected ? <IconCircleCheckmark aria-hidden /> : <IconCircle aria-hidden />;

export function StatesDemo() {
  return (
    <Storybook.Grid>
      <div>
        Focused:
        <Container>
          <Menu.Item label="hello" leadingItems={leadingItems} />
          <Menu.Item label="sentry" leadingItems={leadingItems} isFocused />
          <Menu.Item label="world" leadingItems={leadingItems} />
        </Container>
      </div>
      <div>
        Selected:
        <Container>
          <Menu.Item label="hello" leadingItems={leadingItems} />
          <Menu.Item
            label="sentry"
            leadingItems={leadingItems}
            isSelected
            priority="primary"
          />
          <Menu.Item label="world" leadingItems={leadingItems} />
        </Container>
      </div>
      <div>
        Disabled:
        <Container>
          <Menu.Item label="hello" leadingItems={leadingItems} />
          <Menu.Item label="sentry" leadingItems={leadingItems} disabled />
          <Menu.Item label="world" leadingItems={leadingItems} />
        </Container>
      </div>
    </Storybook.Grid>
  );
}

export function TrailingDemo() {
  return (
    <Container>
      <Menu.Item label="Item with badge" leadingItems={leadingItems} trailingItems="🚀" />
      <Menu.Item label="Another item" leadingItems={leadingItems} trailingItems="⭐" />
    </Container>
  );
}

export function DetailsDemo() {
  return (
    <Container>
      <Menu.Item
        label="Option with details"
        details="This is additional information about the option"
        leadingItems={leadingItems}
      />
      <Menu.Item
        label="Another option"
        details="More helpful context here"
        leadingItems={leadingItems}
      />
    </Container>
  );
}
