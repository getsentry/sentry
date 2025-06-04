import styled from '@emotion/styled';

import ListItem from 'sentry/components/list/listItem';
import {space} from 'sentry/styles/space';

type Props = {
  children: React.ReactElement;
  title: React.ReactNode;
  className?: string;
  subtitle?: React.ReactNode;
};

const Item = styled(({title, subtitle, children, className}: Props) => (
  <ListItem className={className}>
    {title}
    {subtitle && <small>{subtitle}</small>}
    <div>{children}</div>
  </ListItem>
))`
  padding-top: ${space(0.25)};
  display: grid;
  gap: ${space(1.5)};
`;

export default Item;
