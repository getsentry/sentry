import React from 'react';
import styled from '@emotion/styled';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import ExternalLink from 'app/components/links/externalLink';
import {IconSentryFull} from 'app/icons';
import {t} from 'app/locale';
import OrganizationStore from 'app/stores/organizationStore';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';

type Props = {organization?: Organization};

function DemoHeader({organization}: Props) {
  return (
    <Wrapper>
      <LogoSvg />
      <ButtonBar gap={4}>
        <StyledExternalLink href="https://docs.sentry.io">
          {t('Documentation')}
        </StyledExternalLink>
        <GetStarted
          onClick={() =>
            trackAdvancedAnalyticsEvent('growth.demo_click_get_started', {}, organization)
          }
          href="https://sentry.io/signup/"
        >
          {t('Get Started')}
        </GetStarted>
      </ButtonBar>
    </Wrapper>
  );
}

//can't use withOrganization here since we aren't within the OrganizationContext
export default createReactClass<Omit<Props, 'organization'>>({
  displayName: 'DemoHeader',
  mixins: [Reflux.connect(OrganizationStore, 'organization') as any],
  render() {
    const organization = this.state.organization?.organization as
      | Organization
      | undefined;
    return <DemoHeader organization={organization} />;
  },
});

//Note many of the colors don't come from the theme as they come from the marketing site
const Wrapper = styled('div')`
  padding-right: ${space(3)};
  background-color: ${p => p.theme.white};
  height: ${p => p.theme.demo.headerSize};
  display: flex;
  justify-content: space-between;
  text-transform: uppercase;
  margin-left: calc(-1 * ${p => p.theme.sidebar.expandedWidth});
  position: fixed;
  width: 100%;
  border-bottom: 1px solid ${p => p.theme.border};
  z-index: ${p => p.theme.zIndex.settingsSidebarNav};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    height: ${p => p.theme.sidebar.mobileHeight};
    margin-left: 0;
  }
`;

const LogoSvg = styled(IconSentryFull)`
  margin-top: auto;
  margin-bottom: auto;
  margin-left: 20px;
  width: 130px;
  height: 30px;
  color: ${p => p.theme.textColor};
`;

const GetStarted = styled(Button)`
  background-color: #e1567c;
  color: #fff;
  box-shadow: 0 2px 0 rgb(54 45 89 / 10%);
  border-color: transparent;
  border-radius: 2rem;
  text-transform: uppercase;
`;

const StyledExternalLink = styled(ExternalLink)`
  color: #584774;
`;
