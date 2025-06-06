import {Fragment} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type UserRowProps = {
  lastSeen: string;
  name: string;
  organizations: string;
  // more stuff for checkbox
};

function MergeAccounts() {
  return (
    <Fragment>
      <SentryDocumentTitle title={t('Merge Accounts')} />
      <SettingsPageHeader title={t('Merge Accounts')} />

      <TextBlock>
        {t(`Select the accounts that you want to merge into your currently active account,
          then confirm and merge.`)}
      </TextBlock>

      <Users />
    </Fragment>
  );
}

export default MergeAccounts;

function Users() {
  return (
    <Panel>
      <UserPanelHeader>
        <div>{t('Name')}</div>
        <div>{t('Last Active')}</div>
        <div>{t('Organizations')}</div>
      </UserPanelHeader>
      <PanelBody>
        <UserRow
          name="michelle"
          lastSeen="05 October 2024 14:48 UTC"
          organizations="hojicha, matcha, sentry, sencha, mf-test-n7"
        />
        <UserRow
          name="michelle.fu"
          lastSeen="05 October 2011 14:48 UTC"
          organizations=""
        />
      </PanelBody>
    </Panel>
  );
}

function UserRow({name, lastSeen, organizations}: UserRowProps) {
  return (
    <UserPanelItem>
      <Name>{name}</Name>
      <div>
        <StyledTimeSince date={lastSeen} />
      </div>
      <Organizations>{organizations}</Organizations>
    </UserPanelItem>
  );
}

export const tableLayout = `
  display: grid;
  grid-template-columns: auto 140px 140px;
  gap ${space(1)};
  align-items: center;
`;

const UserPanelItem = styled(PanelItem)`
  ${tableLayout};
`;

const Name = styled('div')`
  margin-bottom: ${space(0.5)};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const StyledTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;

const UserPanelHeader = styled(PanelHeader)`
  ${tableLayout}
  justify-content: initial;
`;

const Organizations = styled('div')`
  margin-bottom: ${space(0.5)};
`;
