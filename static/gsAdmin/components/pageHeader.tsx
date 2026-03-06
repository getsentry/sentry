import styled from '@emotion/styled';

type Props = Omit<React.HTMLProps<HTMLHeadingElement>, 'title'> & {
  title: React.ReactNode;
  breadcrumbs?: React.ReactNode[];
};

const Breadcrumbs = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.lg};

  & > *:not(:first-child) {
    display: flex;
    align-items: center;
    gap: ${p => p.theme.space.md};

    &:before {
      content: '\203A';
    }
  }
`;

const Heading = styled('h1')`
  font-size: ${p => p.theme.font.size.xl};
  text-transform: uppercase;
  margin: 0;
`;

const PageHeader = styled(({children, title, breadcrumbs, ...props}: Props) => (
  <header {...props}>
    <Breadcrumbs>
      <Heading>{title}</Heading>
      {breadcrumbs?.map((item, i) => (
        <div key={i}>{item}</div>
      ))}
    </Breadcrumbs>
    {children}
  </header>
))`
  padding: 0;
  margin: ${p => p.theme.space.xl} 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
`;

export default PageHeader;
