import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {openModal} from 'sentry/actionCreators/modal';
import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import {Link} from 'sentry/components/core/link';
import {SentryAppPublishRequestModal} from 'sentry/components/modals/sentryAppPublishRequestModal/sentryAppPublishRequestModal';
import PanelItem from 'sentry/components/panels/panelItem';
import {space} from 'sentry/styles/space';
import type {SentryApp} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

import SentryApplicationRowButtons from './sentryApplicationRowButtons';

interface Props {
  app: SentryApp;
  onPublishSubmission: () => void;
  onRemoveApp: (app: SentryApp) => void;
  organization: Organization;
}

export default function SentryApplicationRow({
  app,
  organization,
  onPublishSubmission,
  onRemoveApp,
}: Props) {
  const isInternal = app.status === 'internal';

  // no publishing for internal apps so hide the status on the developer
  // settings page
  const hideStatus = isInternal;

  const handlePublish = () =>
    openModal(deps => (
      <SentryAppPublishRequestModal
        organization={organization}
        app={app}
        onPublishSubmission={onPublishSubmission}
        {...deps}
      />
    ));

  return (
    <SentryAppItem data-test-id={app.slug}>
      <StyledFlex>
        <SentryAppAvatar sentryApp={app} size={36} />
        <SentryAppBox>
          <SentryAppName hideStatus={hideStatus}>
            <Link to={`/settings/${organization.slug}/developer-settings/${app.slug}/`}>
              {app.name}
            </Link>
          </SentryAppName>
          <SentryAppDetails>
            {!hideStatus && <PublishStatus status={app.status} />}
          </SentryAppDetails>
        </SentryAppBox>

        <Box>
          <SentryApplicationRowButtons
            organization={organization}
            app={app}
            onClickRemove={onRemoveApp}
            onClickPublish={handlePublish}
          />
        </Box>
      </StyledFlex>
    </SentryAppItem>
  );
}

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
    props.status === 'published'
      ? props.theme.tokens.content.success
      : props.theme.colors.gray400};
  font-weight: light;
  margin-right: ${space(0.75)};
`;
