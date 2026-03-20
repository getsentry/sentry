import styled from '@emotion/styled';

import {ListItem} from 'sentry/components/list/listItem';

type Props = {
  children: React.ReactElement;
  title: React.ReactNode;
  className?: string;
  subtitle?: React.ReactNode;
};

export const Item = styled(({title, subtitle, children, className}: Props) => (
  <ListItem className={className}>
    {title}
    {subtitle && <small>{subtitle}</small>}
    <div>{children}</div>
  </ListItem>
))`
  padding-top: ${p => p.theme.space['2xs']};
  display: grid;
  gap: ${p => p.theme.space.lg};
`;
