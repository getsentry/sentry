import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {t} from 'app/locale';
import {Panel, PanelItem} from 'app/components/panels';
import ButtonBar from 'app/components/buttonBar';
import {IconAttachment, IconSettings} from 'app/icons';
import Button from 'app/components/button';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {crashReportTypes} from 'app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsFilter';

type Props = {
  orgSlug: string;
  projectSlug: string;
  location: Location;
  groupId: string;
};

const EventAttachmentsCrashReportsNotice = ({
  orgSlug,
  projectSlug,
  location,
  groupId,
}: Props) => {
  const settingsUrl = `/settings/${orgSlug}/projects/${projectSlug}/security-and-privacy/`;
  const attachmentsUrl = {
    pathname: `/organizations/${orgSlug}/issues/${groupId}/attachments/`,
    query: {...location.query, types: crashReportTypes},
  };

  return (
    <Panel>
      <StyledPanelItem>
        <StyledIconAttachment size="lg" color="gray400" />

        <Title>
          {t('The crash report did not get stored!')}
          <Reason>
            {t('Your limit of stored crash reports has been reached for this issue.')}
          </Reason>
        </Title>

        <ButtonBar gap={0.5}>
          <Button size="xsmall" priority="primary" to={attachmentsUrl}>
            {t('View Crashes')}
          </Button>
          <Button
            size="xsmall"
            icon={<IconSettings size="xs" />}
            title={t('Change Settings')}
            to={settingsUrl}
          />
        </ButtonBar>
      </StyledPanelItem>
    </Panel>
  );
};

const StyledPanelItem = styled(PanelItem)`
  align-items: center;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const StyledIconAttachment = styled(IconAttachment)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const Title = styled('div')`
  margin-bottom: ${space(1)};
  flex: 1;
  font-weight: 600;
  line-height: 1.3;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    ${overflowEllipsis};
    margin: 0 ${space(1)} 0 ${space(1.5)};
  }
`;

const Reason = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray500};
  margin-top: ${space(1)};
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    ${overflowEllipsis};
    margin-top: 0;
  }
`;

export default EventAttachmentsCrashReportsNotice;
