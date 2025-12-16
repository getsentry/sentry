import {Flex} from '@sentry/scraps/layout';
import {Stack} from '@sentry/scraps/layout';
import styled from '@emotion/styled';

export const Header = ({children}: {children?: React.ReactNode}) => (
  <Flex justify="space-between" align="center" gap="lg">{children}</Flex>
);

export const Sidebar = ({children}: {children?: React.ReactNode}) => (
  <Stack as="aside" direction="column" gap="sm">{children}</Stack>
);



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
