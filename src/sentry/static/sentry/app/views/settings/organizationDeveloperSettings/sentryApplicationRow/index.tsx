import React from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import PluginIcon from 'app/plugins/components/pluginIcon';
import {openModal} from 'app/actionCreators/modal';
import SentryAppPublishRequestModal from 'app/components/modals/sentryAppPublishRequestModal';
import {Organization, SentryApp} from 'app/types';

import SentryApplicationRowButtons from './sentryApplicationRowButtons';

type Props = {
  app: SentryApp;
  organization: Organization;
  onRemoveApp: (app: SentryApp) => void;
};

export default class SentryApplicationRow extends React.PureComponent<Props> {
  get isInternal() {
    return this.props.app.status === 'internal';
  }

  hideStatus() {
    //no publishing for internal apps so hide the status on the developer settings page
    return this.isInternal;
  }

  renderStatus() {
    const {app} = this.props;
    if (this.hideStatus()) {
      return null;
    }
    return <PublishStatus status={app.status} />;
  }

  handlePublish = () => {
    const {app} = this.props;

    openModal(deps => <SentryAppPublishRequestModal app={app} {...deps} />);
  };

  render() {
    const {app, organization, onRemoveApp} = this.props;
    return (
      <SentryAppItem data-test-id={app.slug}>
        <StyledFlex>
          <PluginIcon size={36} pluginId={app.slug} />
          <SentryAppBox>
            <SentryAppName hideStatus={this.hideStatus()}>
              <SentryAppLink
                to={`/settings/${organization.slug}/developer-settings/${app.slug}/`}
              >
                {app.name}
              </SentryAppLink>
            </SentryAppName>
            <SentryAppDetails>{this.renderStatus()}</SentryAppDetails>
          </SentryAppBox>

          <Box>
            <SentryApplicationRowButtons
              organization={organization}
              app={app}
              onClickRemove={onRemoveApp}
              onClickPublish={this.handlePublish}
            />
          </Box>
        </StyledFlex>
      </SentryAppItem>
    );
  }
}

const Flex = styled('div')`
  display: flex;
`;

const Box = styled('div')``;

const SentryAppItem = styled(PanelItem)`
  flex-direction: column;
  padding: 5px;
`;

const StyledFlex = styled(Flex)`
  justify-content: center;
  padding: 10px;
`;

const SentryAppBox = styled('div')`
  padding-left: 15px;
  padding-right: 15px;
  flex: 1;
`;

const SentryAppDetails = styled(Flex)`
  align-items: center;
  margin-top: 6px;
  font-size: 0.8em;
`;

const SentryAppName = styled('div')<{hideStatus: boolean}>`
  font-weight: bold;
  margin-top: ${p => (p.hideStatus ? '10px' : '0px')};
`;

const SentryAppLink = styled(Link)`
  color: ${props => props.theme.textColor};
`;

const CenterFlex = styled(Flex)`
  align-items: center;
`;

type PublishStatusProps = {status: SentryApp['status']; theme?: any};

const PublishStatus = styled(({status, ...props}: PublishStatusProps) => (
  <CenterFlex>
    <div {...props}>{t(`${status}`)}</div>
  </CenterFlex>
))`
  color: ${(props: PublishStatusProps) =>
    props.status === 'published' ? props.theme.success : props.theme.gray500};
  font-weight: light;
  margin-right: ${space(0.75)};
`;
