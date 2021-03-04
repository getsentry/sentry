import React from 'react';
import styled from '@emotion/styled';

import Hook from 'app/components/hook';
import ExternalLink from 'app/components/links/externalLink';
import {IconSentry} from 'app/icons';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import space from 'app/styles/space';
import getDynamicText from 'app/utils/getDynamicText';

type Props = {
  className?: string;
};

function Footer({className}: Props) {
  const config = ConfigStore.getConfig();
  return (
    <footer className={className}>
      <div>
        {config.isOnPremise && (
          <React.Fragment>
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
          </React.Fragment>
        )}
      </div>
      <LogoLink />
      <Links>
        <FooterLink href="/api/">{t('API')}</FooterLink>
        <FooterLink href="/docs/">{t('Docs')}</FooterLink>
        <FooterLink href="https://github.com/getsentry/sentry">
          {t('Contribute')}
        </FooterLink>
        {config.isOnPremise && (
          <FooterLink href="/out/">{t('Migrate to SaaS')}</FooterLink>
        )}
      </Links>
      <Hook name="footer" />
    </footer>
  );
}

const Links = styled('div')`
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
  <a href="/" tabIndex={-1} {...props}>
    <IconSentry size="xl" />
  </a>
))`
  color: ${p => p.theme.subText};
  display: block;
  width: 32px;
  height: 32px;
  margin: 0 auto;
`;

const Build = styled('span')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  color: ${p => p.theme.subText};
  font-weight: bold;
  margin-left: ${space(1)};
`;

const StyledFooter = styled(Footer)`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  color: ${p => p.theme.subText};
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(4)};
  margin-top: 20px;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

export default StyledFooter;
