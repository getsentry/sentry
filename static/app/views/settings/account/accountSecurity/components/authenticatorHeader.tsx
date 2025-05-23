import styled from '@emotion/styled';

import CircleIndicator from 'sentry/components/circleIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface AuthenticatorHeaderProps {
  isActive: boolean;
  name: string;
}

export function AuthenticatorHeader({name, isActive}: AuthenticatorHeaderProps) {
  return (
    <PageTitle>
      <CircleIndicator
        role="status"
        aria-label={
          isActive
            ? t('Authentication Method Active')
            : t('Authentication Method Inactive')
        }
        enabled={isActive}
      />
      {name}
    </PageTitle>
  );
}

const PageTitle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
