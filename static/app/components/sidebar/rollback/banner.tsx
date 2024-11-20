import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {IconClose, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

type RollbackBannerProps = {
  organization: Organization;
  className?: string;
  handleDismiss?: () => void;
};

export function RollbackBanner({
  className,
  handleDismiss,
  organization,
}: RollbackBannerProps) {
  return (
    <StyledPanel className={className}>
      <Title>🥳 {t('Your 2024 Rollback')}</Title>
      <Description>
        {t("See what you did (and didn't do) with %s this year.", organization.name)}
      </Description>
      <RollbackButton
        external
        href={`https://rollback.sentry.io/${organization.slug}/`}
        icon={<IconOpen />}
        priority="primary"
        size="xs"
        analyticsEventKey="rollback.sidebar_view_clicked"
        analyticsEventName="Rollback: Sidebar View Clicked"
      >
        {t('View My Rollback')}
      </RollbackButton>
      {handleDismiss ? (
        <DismissButton
          icon={<IconClose />}
          aria-label={t('Dismiss')}
          onClick={handleDismiss}
          size="xs"
          borderless
          analyticsEventKey="rollback.sidebar_dismiss_clicked"
          analyticsEventName="Rollback: Sidebar Dismiss Clicked"
        />
      ) : null}
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  position: relative;
  background: linear-gradient(
    269.35deg,
    ${p => p.theme.backgroundTertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );
  padding: ${space(1)};
  margin: ${space(1)};
  color: ${p => p.theme.textColor};
`;

const Title = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

const Description = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
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

const DismissButton = styled(Button)`
  position: absolute;
  top: 0;
  right: 0;

  color: currentColor;

  &:hover {
    color: currentColor;
  }
`;
