import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text';
import {IconSeer} from 'sentry/icons';

interface SeerSearchHeaderProps {
  title: string;
  loading?: boolean;
}

export function SeerSearchHeader({title, loading = false}: SeerSearchHeaderProps) {
  return (
    <HeaderWrapper>
      <StyledIconSeer variant={loading ? 'loading' : 'default'} />
      <Text>{title}</Text>
    </HeaderWrapper>
  );
}

const HeaderWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  width: 100%;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledIconSeer = styled(IconSeer)`
  color: ${p => p.theme.purple400};
`;
