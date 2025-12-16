import {Flex, Stack} from '@sentry/scraps/layout';

export function Header({children}: {children?: React.ReactNode}) {
  return (
    <Flex justify="space-between" align="center" gap="lg">
      {children}
    </Flex>
  );
}

export function Sidebar({children}: {children?: React.ReactNode}) {
  return (
    <Stack as="aside" direction="column" gap="sm">
      {children}
    </Stack>
  );
}

export default function Layout() {
  return (
    <div>
      <Header>
        <h1>Title</h1>
        <button>Action</button>
      </Header>
      <Sidebar>
        <a>Link 1</a>
        <a>Link 2</a>
      </Sidebar>
      <Flex as="span" gap="xs">
        <span>Item</span>
      </Flex>
    </div>
  );
}
