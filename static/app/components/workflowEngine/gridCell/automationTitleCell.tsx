import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';

interface Props {
  link: string;
  name: string;
}

export default function AutomationTitleCell({name, link}: Props) {
  return <StyledLink to={link}>{name}</StyledLink>;
}

const StyledLink = styled(Link)`
  padding: ${space(2)};
  margin: -${space(2)};
  color: ${p => p.theme.textColor};

  &:hover,
  &:active {
    text-decoration: underline;
    color: ${p => p.theme.textColor};
  }
`;
