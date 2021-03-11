import React from 'react';
import styled from '@emotion/styled';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import sentry from 'sentry-images/logos/logo-sentry.svg';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import ExternalLink from 'app/components/links/externalLink';
import {t} from 'app/locale';
import OrganizationStore from 'app/stores/organizationStore';
import {Organization} from 'app/types';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';

type Props = {organization?: Organization};

function DemoHeader({organization}: Props) {
  return (
    <Wrapper>
      <ImageAndName>
        <Image />
        <SentryWrapper>Sentry</SentryWrapper>
      </ImageAndName>
      <StyledButtonBar gap={1}>
        <ExternalLink href="https://docs.sentry.io">{t('Documentation')}</ExternalLink>
        <GetStarted
          onClick={() =>
            trackAdvancedAnalyticsEvent('growth.demo_click_get_started', {}, organization)
          }
          href="https://sentry.io/signup/"
        >
          {t('Get Started')}
        </GetStarted>
      </StyledButtonBar>
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

const Wrapper = styled('div')`
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

const ImageAndName = styled('div')`
  margin-top: auto;
  margin-bottom: auto;
  margin-left: 20px;
  display: flex;
`;

const Image = styled('div')`
  display: inline-block;
  background-size: contain;
  background-position: center center;
  background-repeat: no-repeat;
  background-image: url(${sentry});
  height: 30px;
  width: 30px;
`;

const GetStarted = styled(Button)`
  background-color: #e1567c;
  color: #fff;
  box-shadow: 0 2px 0 rgb(54 45 89 / 10%);
  border-color: transparent;
  border-radius: 2rem;
  text-transform: uppercase;
`;

const SentryWrapper = styled('div')`
  margin: auto;
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-right: 20px;
`;
