import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type RollbackBannerProps = {};

function useRollback() {
  const organization = useOrganization();

  return useApiQuery([`/organizations/${organization.slug}/user-rollback/`], {
    staleTime: Infinity,
    retry: false,
    enabled: organization.features.includes('sentry-rollback-2024'),
    retryOnMount: false,
  });
}

export function RollbackBanner({}: RollbackBannerProps) {
  const organization = useOrganization();
  const {data} = useRollback();

  if (!data) {
    return null;
  }

  return (
    <StyledPanel>
      <Title>🥳 {t('Your 2024 Rollback')}</Title>
      <Description>
        {t("See what you did (and didn't do) with %s this year.", organization.name)}
      </Description>
      <RollbackButton
        external
        href={`https://rollback.sentry.io/${organization.slug}/`}
        icon={<IconOpen />}
        priority="primary"
        size="sm"
      >
        {t('View My Rollback')}
      </RollbackButton>
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  background: linear-gradient(
    269.35deg,
    ${p => p.theme.backgroundTertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );
  padding: ${space(1)};
  margin: ${space(1)};
`;

const Title = styled('p')`
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

const Description = styled('p')`
  margin: ${space(0.5)} 0;
`;

const RollbackButton = styled(LinkButton)`
  background: #ff45a8;
  border-color: #ff45a8;
  margin: 0 auto;
  width: 100%;

  &:hover {
    border-color: #ff45a8;
  }
`;
