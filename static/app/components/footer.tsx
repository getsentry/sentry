import {Fragment} from 'react';
import styled from '@emotion/styled';

import Hook from 'sentry/components/hook';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconSentry, IconSentryPrideLogo} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import getDynamicText from 'sentry/utils/getDynamicText';
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
  const organization = useOrganization({allowNull: true});

  return (
    <footer className={className}>
      <LeftLinks>
        {isSelfHosted && (
          <Fragment>
            {'Sentry '}
            {getDynamicText({
              fixed: 'Acceptance Test',
              value: version.current,
            })}
            <Build>
              {getDynamicText({
                fixed: 'test',
                value: version.build.substring(0, 7),
              })}
            </Build>
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
        {!isSelfHosted && (
          <FooterLink href="https://status.sentry.io/">{t('Service Status')}</FooterLink>
        )}
        <FooterLink href="/api/">{t('API')}</FooterLink>
        <FooterLink href="/docs/">{t('Docs')}</FooterLink>
        <FooterLink href="https://github.com/getsentry/sentry">
          {t('Contribute')}
        </FooterLink>
        {isSelfHosted && !demoMode && (
          <FooterLink href="/out/">{t('Migrate to SaaS')}</FooterLink>
        )}
      </RightLinks>
      <Hook name="footer" />
    </footer>
  );
}

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
    box-shadow: ${p => p.theme.blue300} 0 2px 0;
  }
`;

const SentryLogoLink = styled(ExternalLink)`
  display: flex;
  align-items: center;
  margin: 0 auto;
  color: ${p => p.theme.subText};
`;

const Build = styled('span')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
  margin-left: ${space(1)};
`;

const Footer = styled(BaseFooter)`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  border-top: 1px solid ${p => p.theme.border};
  align-content: center;
  padding: ${space(2)} ${space(4)};
  margin-top: auto; /* pushes footer to the bottom of the page when loading */

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(2)};
  }

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

export default Footer;
