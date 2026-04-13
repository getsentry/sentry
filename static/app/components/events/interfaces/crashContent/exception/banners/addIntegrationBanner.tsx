import styled from '@emotion/styled';

import addIntegrationProvider from 'sentry-images/spot/add-integration-provider.svg';

import {Button, LinkButton} from '@sentry/scraps/button';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

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
        priority="link"
        aria-label={t('Dismiss')}
        icon={<IconClose variant="muted" />}
        size="xs"
        onClick={onDismiss}
      />
    </StacktraceIntegrationBannerWrapper>
  );
}

const StacktraceIntegrationBannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.xl};
  margin: ${p => p.theme.space.md} 0;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, ${p => p.theme.tokens.background.secondary} 0%, transparent) 0%,
    ${p => p.theme.tokens.background.secondary} 70%,
    ${p => p.theme.tokens.background.secondary} 100%
  );
`;

const IntegationBannerTitle = styled('div')`
  font-size: ${p => p.theme.font.size.xl};
  margin-bottom: ${p => p.theme.space.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const IntegationBannerDescription = styled('div')`
  margin-bottom: ${p => p.theme.space.lg};
  max-width: 340px;
`;

const CloseBannerButton = styled(Button)`
  position: absolute;
  display: block;
  top: ${p => p.theme.space.xl};
  right: ${p => p.theme.space.xl};
  color: ${p => p.theme.colors.white};
  cursor: pointer;
  z-index: 1;
`;

const IntegrationBannerImage = styled('img')`
  position: absolute;
  display: block;
  bottom: 0px;
  right: 4rem;
  pointer-events: none;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;
