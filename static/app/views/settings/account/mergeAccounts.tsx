import {createContext, Fragment, useContext} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
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
const UserContext = createContext<boolean>(false);

function MergeAccounts() {
  return (
    <Fragment>
      <SentryDocumentTitle title={t('Merge Accounts')} />
      <SettingsPageHeader title={t('Merge Accounts')} />

      <TextBlock>
        {t(`Select the accounts that you want to merge into your currently active account,
          then confirm and merge. The accounts that you do not select will be deleted.`)}
      </TextBlock>
      <TextBlock>{t(`Your currently active account:`)}</TextBlock>
      <UserContext value>
        <Users />
      </UserContext>
      <TextBlock>{t(`Your other accounts:`)}</TextBlock>
      <UserContext value={false}>
        <Users />
      </UserContext>
      <Button priority="danger">Merge [3] accounts into [michelle.primary]</Button>
    </Fragment>
  );
}

export default MergeAccounts;

function Users() {
  const isPrimaryUser = useContext(UserContext);
  if (isPrimaryUser) {
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
        </PanelBody>
      </Panel>
    );
  }
  return (
    <Panel>
      <UserPanelHeader>
        <div>{t('Name')}</div>
        <div>{t('Last Active')}</div>
        <div>{t('Organizations')}</div>
        <div>{t('Merge')}</div>
      </UserPanelHeader>
      <PanelBody>
        <UserRow
          name="michelle"
          lastSeen="05 October 2024 14:48 UTC"
          organizations="hojicha, matcha, sentry, sencha, mf-test-n7"
        />
        <UserRow name="michelle.fu" lastSeen="" organizations="" />
      </PanelBody>
    </Panel>
  );
}

function UserRow({name, lastSeen, organizations}: UserRowProps) {
  const isPrimaryUser = useContext(UserContext);
  return (
    <UserPanelItem>
      <Name>{name}</Name>
      {isPrimaryUser ? (
        'Currently active'
      ) : lastSeen === '' ? (
        'Never'
      ) : (
        <div>
          <StyledTimeSince date={lastSeen} />
        </div>
      )}
      <Organizations>{organizations}</Organizations>
      {isPrimaryUser ? null : (
        <div>
          <input
            type="checkbox"
            name="user"
            value={name}
            onChange={() => null}
            style={{margin: 5}}
          />
        </div>
      )}
    </UserPanelItem>
  );
}

export const tableLayout = `
  display: grid;
  grid-template-columns: auto 140px 140px 60px;
  gap ${space(1)};
  align-items: center;
`;

const UserPanelItem = styled(PanelItem)`
  ${tableLayout};
`;

const Name = styled('div')`
  margin-bottom: ${space(0.5)};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const StyledTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.fontSize.md};
`;

const UserPanelHeader = styled(PanelHeader)`
  ${tableLayout}
  justify-content: initial;
`;

const Organizations = styled('div')`
  margin-bottom: ${space(0.5)};
`;
