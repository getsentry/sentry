import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {useFrontendVersion} from 'sentry/components/frontendVersionContext';
import Hook from 'sentry/components/hook';
import {IconSentry, IconSentryPrideLogo} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

type SentryLogoProps = SVGIconProps & {
  /**
   * Displays the sentry pride logo instead of the regular logo
   */
  pride?: boolean;
};

function SentryLogo({pride, fill, ...props}: SentryLogoProps) {
  if (pride) {
    return <IconSentryPrideLogo {...props} />;
  }

  return <IconSentry fill={fill} {...props} />;
}

type Props = {
  className?: string;
};

function BaseFooter({className}: Props) {
  const {isSelfHosted, version, privacyUrl, termsUrl, demoMode} =
    useLegacyStore(ConfigStore);

  const {state: appState} = useFrontendVersion();
  const organization = useOrganization({allowNull: true});

  return (
    <Container as="footer" background="primary" className={className}>
      <LeftLinks>
        {isSelfHosted && (
          <Fragment>
            {'Sentry '}
            {version.current}
            <Build>{version.build.substring(0, 7)}</Build>
          </Fragment>
        )}
        {privacyUrl && <FooterLink href={privacyUrl}>{t('Privacy Policy')}</FooterLink>}
        {termsUrl && <FooterLink href={termsUrl}>{t('Terms of Use')}</FooterLink>}
      </LeftLinks>
      <SentryLogoLink href="https://sentry.io/welcome/" tabIndex={-1}>
        <SentryLogo
          size="lg"
          pride={(organization?.features ?? []).includes('sentry-pride-logo-footer')}
        />
      </SentryLogoLink>
      <RightLinks>
        {appState === 'stale' && (
          <Button
            borderless
            size="xs"
            onClick={() => window.location.reload()}
            title={t(
              "An improved version of Sentry's Frontend Application is now available. Click to update now."
            )}
            aria-label={t('Reload frontend')}
          >
            <WaitingIndicator />
          </Button>
        )}
        {!isSelfHosted && (
          <FooterLink href="https://status.sentry.io/">{t('Service Status')}</FooterLink>
        )}
        <FooterLink href="https://docs.sentry.io/api/">{t('API')}</FooterLink>
        <FooterLink href="/docs/">{t('Docs')}</FooterLink>
        <FooterLink href="https://github.com/getsentry/sentry">
          {t('Contribute')}
        </FooterLink>
        {isSelfHosted && !demoMode && (
          <FooterLink href="/out/">{t('Migrate to SaaS')}</FooterLink>
        )}
      </RightLinks>
      <Hook name="footer" />
    </Container>
  );
}

const WaitingIndicator = styled('div')`
  --pulsingIndicatorRing: ${p => p.theme.colors.gray200};
  ${pulsingIndicatorStyles};
  contain: layout;
`;

const LeftLinks = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  align-items: center;
  justify-self: flex-start;
  gap: ${space(2)};
`;

const RightLinks = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  align-items: center;
  justify-self: flex-end;
  gap: ${space(2)};
`;

const FooterLink = styled(ExternalLink)`
  color: ${p => p.theme.subText};
  &:focus-visible {
    outline: none;
    box-shadow: ${p => p.theme.colors.blue400} 0 2px 0;
  }
`;

const SentryLogoLink = styled(ExternalLink)`
  display: flex;
  align-items: center;
  margin: 0 auto;
  color: ${p => p.theme.subText};
`;

const Build = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-left: ${space(1)};
`;

const Footer = styled(BaseFooter)`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  align-content: center;
  padding: ${space(2)} ${space(4)};
  margin-top: auto; /* pushes footer to the bottom of the page when loading */

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(2)};
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;

export default Footer;
