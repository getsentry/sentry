import styled from '@emotion/styled';

import addIntegrationProvider from 'sentry-images/spot/add-integration-provider.svg';

import {Button, LinkButton} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface AddIntegrationBannerProps {
  onDismiss: () => void;
  orgSlug: string;
}

/**
 * Displayed when there are no installed source integrations (github/gitlab/etc)
 */
export function AddIntegrationBanner({orgSlug, onDismiss}: AddIntegrationBannerProps) {
  return (
    <StacktraceIntegrationBannerWrapper>
      <div>
        <IntegationBannerTitle>{t('Connect with Git Providers')}</IntegationBannerTitle>
        <IntegationBannerDescription>
          {t(
            'Install Git providers (GitHub, GitLab…) to enable features like code mapping and stack trace linking.'
          )}
        </IntegationBannerDescription>
        <LinkButton
          to={{
            pathname: `/settings/${orgSlug}/integrations/`,
            // This should filter to only source code management integrations
            query: {category: 'source code management'},
          }}
          size="sm"
        >
          {t('Get Started')}
        </LinkButton>
      </div>
      <IntegrationBannerImage src={addIntegrationProvider} />
      <CloseBannerButton
        borderless
        priority="link"
        aria-label={t('Dismiss')}
        icon={<IconClose color="subText" />}
        size="xs"
        onClick={onDismiss}
      />
    </StacktraceIntegrationBannerWrapper>
  );
}

export const StacktraceIntegrationBannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)};
  margin: ${space(1)} 0;
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
`;

export const IntegationBannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
`;

export const IntegationBannerDescription = styled('div')`
  margin-bottom: ${space(1.5)};
  max-width: 340px;
`;

export const CloseBannerButton = styled(Button)`
  position: absolute;
  display: block;
  top: ${space(2)};
  right: ${space(2)};
  color: ${p => p.theme.white};
  cursor: pointer;
  z-index: 1;
`;

const IntegrationBannerImage = styled('img')`
  position: absolute;
  display: block;
  bottom: 0px;
  right: 4rem;
  pointer-events: none;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;
