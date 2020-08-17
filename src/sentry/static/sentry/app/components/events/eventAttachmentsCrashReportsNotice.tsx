import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {t} from 'app/locale';
import {Panel, PanelItem} from 'app/components/panels';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ButtonBar from 'app/components/buttonBar';
import {IconAttachment, IconChevron, IconSettings} from 'app/icons';
import Button from 'app/components/button';
import localStorage from 'app/utils/localStorage';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

const NOTICE_DISMISSED_KEY = 'crash-reports-limit-reached-notice-dismissed';

type Props = {
  orgSlug: string;
  projectSlug: string;
  location: Location;
  groupId: string;
};

type State = {
  isCollapsed: boolean;
};

class EventAttachmentsCrashReportsNotice extends React.Component<Props, State> {
  state: State = {
    isCollapsed: localStorage.getItem(NOTICE_DISMISSED_KEY) === 'true',
  };

  toggleNotice = () => {
    this.setState(
      state => ({isCollapsed: !state.isCollapsed}),
      () => {
        localStorage.setItem(NOTICE_DISMISSED_KEY, String(this.state.isCollapsed));
      }
    );
  };

  render() {
    const {isCollapsed} = this.state;
    const {orgSlug, projectSlug, groupId, location} = this.props;

    const settingsUrl = `/settings/${orgSlug}/projects/${projectSlug}/security-and-privacy/`;
    const attachmentsUrl = {
      pathname: `/organizations/${orgSlug}/issues/${groupId}/attachments/`,
      query: location.query,
    };

    return (
      <Panel>
        {isCollapsed && (
          <StyledPanelItem>
            <IconAttachment size="lg" color="gray400" />

            <ToggledTitle>
              {t('Some crash reports did not get stored!')}
              <ToggledReason>
                {t(
                  'Your current limit of stored crash reports per issue has been reached.'
                )}
              </ToggledReason>
            </ToggledTitle>

            <ButtonBar gap={0.5}>
              <Button size="xsmall" priority="primary" to={attachmentsUrl}>
                {t('Issue Attachments')}
              </Button>
              <Button
                size="xsmall"
                icon={<IconSettings size="xs" />}
                title={t('Change Settings')}
                to={settingsUrl}
              />
              <Button
                size="xsmall"
                icon={<IconChevron direction="down" size="xs" />}
                onClick={this.toggleNotice}
              />
            </ButtonBar>
          </StyledPanelItem>
        )}

        {!isCollapsed && (
          <React.Fragment>
            <ToggleButton
              onClick={this.toggleNotice}
              icon={<IconChevron direction="up" size="md" />}
              priority="link"
            />

            <EmptyMessage
              icon={<IconAttachment size="xl" />}
              title={t('Some crash reports did not get stored!')}
              description={t(
                'Your current limit of stored crash reports per issue has been reached.'
              )}
              action={
                <ButtonBar gap={1}>
                  <Button priority="primary" to={attachmentsUrl}>
                    {t('Issue Attachments')}
                  </Button>
                  <Button to={settingsUrl}>{t('Change Settings')}</Button>
                </ButtonBar>
              }
            />
          </React.Fragment>
        )}
      </Panel>
    );
  }
}

const ToggleButton = styled(Button)`
  position: absolute;
  top: 0;
  right: 0;
  color: ${p => p.theme.gray400};
  padding: ${space(2)};

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.gray500};
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const StyledPanelItem = styled(PanelItem)`
  align-items: center;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    flex-direction: column;
    text-align: center;
  }
`;

const ToggledTitle = styled('div')`
  margin: ${space(2)} 0;
  flex: 1;
  font-weight: 600;
  line-height: 1.3;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    ${overflowEllipsis};
    margin: 0 ${space(1)} 0 ${space(1.5)};
  }
`;

const ToggledReason = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray500};
  margin-top: ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    ${overflowEllipsis};
    margin-top: 0;
  }
`;

export default EventAttachmentsCrashReportsNotice;
