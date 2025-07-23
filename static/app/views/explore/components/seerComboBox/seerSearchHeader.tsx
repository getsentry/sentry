import styled from '@emotion/styled';

import {IconSeer} from 'sentry/icons';

interface SeerSearchHeaderProps {
  title: string;
  loading?: boolean;
}

export function SeerSearchHeader({title, loading = false}: SeerSearchHeaderProps) {
  return (
    <HeaderWrapper>
      <IconSeer variant={loading ? 'loading' : 'default'} color="purple300" />
      <Header>{title}</Header>
    </HeaderWrapper>
  );
}

const HeaderWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};

  background: ${p => p.theme.purple100};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  width: 100%;
`;

const Header = styled('h3')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.textColor};
  margin: 0;
`;
