import React from 'react';
import {Link} from 'react-router';
import capitalize from 'lodash/capitalize';
import styled from '@emotion/styled';

import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import PluginIcon from 'app/plugins/components/pluginIcon';
import {Organization, SentryApp, SentryAppInstallation} from 'app/types';

import {NOT_INSTALLED} from './constants';

import IntegrationStatus from './integrationStatus';

type Props = {
  app: SentryApp;
  organization: Organization;
  install?: SentryAppInstallation;
  ['data-test-id']?: string;
};

export default class IntegrationDirectorySentryAppRow extends React.PureComponent<Props> {
  get isInternal() {
    return this.props.app.status === 'internal';
  }

  get isPublished() {
    return this.props.app.status === 'published';
  }

  renderStatus() {
    const {app} = this.props;
    const status = this.installationStatus;
    return (
      <React.Fragment>
        <IntegrationStatus status={status} />
        {!this.isPublished && <PublishStatus status={app.status} />}
      </React.Fragment>
    );
  }

  get installationStatus() {
    if (this.props.install) {
      return capitalize(this.props.install.status) as 'Installed' | 'Pending';
    }

    return NOT_INSTALLED;
  }

  linkToEdit() {
    const {app, organization} = this.props;

    if (this.isInternal) {
      return `/settings/${organization.slug}/developer-settings/${app.slug}/`;
    }

    return `/settings/${organization.slug}/sentry-apps/${app.slug}/`;
    // show the link if the app is internal or we are on the developer settings page
    // We don't want to show the link to edit on the main integrations list unless the app is internal
  }

  render() {
    const {app} = this.props;
    return (
      <SentryAppItem data-test-id={app.slug}>
        <StyledFlex>
          <PluginIcon size={36} pluginId={app.slug} />
          <SentryAppBox>
            <SentryAppName>
              <SentryAppLink to={this.linkToEdit()}>{app.name}</SentryAppLink>
            </SentryAppName>
            <SentryAppDetails>{this.renderStatus()}</SentryAppDetails>
          </SentryAppBox>
        </StyledFlex>
      </SentryAppItem>
    );
  }
}

const SentryAppItem = styled(PanelItem)`
  flex-direction: column;
  padding: 5px;
`;

const StyledFlex = styled('div')`
  display: flex;
  justify-content: center;
  padding: 10px;
`;

const SentryAppBox = styled('div')`
  padding-left: 15px;
  padding-right: 15px;
  flex: 1;
`;

const SentryAppDetails = styled('div')`
  display: flex;
  align-items: center;
  margin-top: 6px;
  font-size: 0.8em;
`;

const SentryAppName = styled('div')`
  font-weight: bold;
  margin-top: 0px;
`;

const SentryAppLink = styled(Link)`
  color: ${props => props.theme.textColor};
`;

const FlexContainer = styled('div')`
  display: flex;
  align-items: center;
`;

type PublishStatusProps = {status: SentryApp['status']; theme?: any};

const PublishStatus = styled(({status, ...props}: PublishStatusProps) => {
  return (
    <FlexContainer>
      <div {...props}>{t(`${status}`)}</div>
    </FlexContainer>
  );
})`
  color: ${(props: PublishStatusProps) =>
    props.status === 'published' ? props.theme.success : props.theme.gray2};
  font-weight: light;
  margin-right: ${space(0.75)};
  text-transform: capitalize;
  &:before {
    content: '|';
    color: ${p => p.theme.gray1};
    margin-right: ${space(0.75)};
    font-weight: normal;
  }
`;
