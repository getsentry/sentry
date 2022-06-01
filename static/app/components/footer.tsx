import {Fragment} from 'react';
import styled from '@emotion/styled';

import Hook from 'sentry/components/hook';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import getDynamicText from 'sentry/utils/getDynamicText';

type Props = {
  className?: string;
};

function BaseFooter({className}: Props) {
  const config = ConfigStore.getConfig();
  return (
    <footer className={className}>
      <LeftLinks>
        {config.isSelfHosted && (
          <Fragment>
            {'Sentry '}
            {getDynamicText({
              fixed: 'Acceptance Test',
              value: config.version.current,
            })}
            <Build>
              {getDynamicText({
                fixed: 'test',
                value: config.version.build.substring(0, 7),
              })}
            </Build>
          </Fragment>
        )}
        {config.privacyUrl && (
          <FooterLink href={config.privacyUrl}>{t('Privacy Policy')}</FooterLink>
        )}
        {config.termsUrl && (
          <FooterLink href={config.termsUrl}>{t('Terms of Use')}</FooterLink>
        )}
      </LeftLinks>
      <LogoLink />
      <RightLinks>
        {!config.isSelfHosted && (
          <FooterLink href="https://status.sentry.io/">{t('Service Status')}</FooterLink>
        )}
        <FooterLink href="/api/">{t('API')}</FooterLink>
        <FooterLink href="/docs/">{t('Docs')}</FooterLink>
        <FooterLink href="https://github.com/getsentry/sentry">
          {t('Contribute')}
        </FooterLink>
        {config.isSelfHosted && !config.demoMode && (
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
  &.focus-visible {
    outline: none;
    box-shadow: ${p => p.theme.blue300} 0 2px 0;
  }
`;

const LogoLink = styled(props => (
  <ExternalLink href="https://sentry.io/welcome/" tabIndex={-1} {...props}>
    <IconSentry size="lg" />
  </ExternalLink>
))`
  display: flex;
  align-items: center;
  margin: 0 auto;
  color: ${p => p.theme.subText};
`;

const Build = styled('span')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  color: ${p => p.theme.subText};
  font-weight: bold;
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

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    padding: ${space(2)};
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

export default Footer;
