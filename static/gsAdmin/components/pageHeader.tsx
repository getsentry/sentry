import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type Props = Omit<React.HTMLProps<HTMLHeadingElement>, 'title'> & {
  title: React.ReactNode;
  breadcrumbs?: React.ReactNode[];
};

const Breadcrumbs = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSize.lg};

  & > *:not(:first-child) {
    display: flex;
    align-items: center;
    gap: ${space(1)};

    &:before {
      content: '\203A';
    }
  }
`;

const Heading = styled('h1')`
  font-size: ${p => p.theme.fontSize.xl};
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
  margin: ${space(2)} 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
`;

export default PageHeader;
