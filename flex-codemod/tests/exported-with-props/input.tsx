import styled from '@emotion/styled';

export const Header = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
`;

export const Sidebar = styled('aside')`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const LocalWrapper = styled('span')`
  display: flex;
  gap: 4px;
`;

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
      <LocalWrapper>
        <span>Item</span>
      </LocalWrapper>
    </div>
  );
}
