import {PureComponent} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Link from 'sentry/components/links/link';
import SentryAppPublishRequestModal from 'sentry/components/modals/sentryAppPublishRequestModal';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryAppIcon from 'sentry/components/sentryAppIcon';
import {space} from 'sentry/styles/space';
import {Organization, SentryApp} from 'sentry/types';

import SentryApplicationRowButtons from './sentryApplicationRowButtons';

type Props = {
  app: SentryApp;
  onRemoveApp: (app: SentryApp) => void;
  organization: Organization;
};

export default class SentryApplicationRow extends PureComponent<Props> {
  get isInternal() {
    return this.props.app.status === 'internal';
  }

  hideStatus() {
    // no publishing for internal apps so hide the status on the developer settings page
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
          <SentryAppIcon sentryApp={app} size={36} />
          <SentryAppBox>
            <SentryAppName hideStatus={this.hideStatus()}>
              <Link to={`/settings/${organization.slug}/developer-settings/${app.slug}/`}>
                {app.name}
              </Link>
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
  margin-top: ${p => (p.hideStatus ? '10px' : '0px')};
`;

const CenterFlex = styled(Flex)`
  align-items: center;
`;

type PublishStatusProps = {status: SentryApp['status']; theme?: any};

const PublishStatus = styled(({status, ...props}: PublishStatusProps) => (
  <CenterFlex>
    <div {...props}>{status}</div>
  </CenterFlex>
))`
  color: ${(props: PublishStatusProps) =>
    props.status === 'published' ? props.theme.success : props.theme.gray300};
  font-weight: light;
  margin-right: ${space(0.75)};
`;
