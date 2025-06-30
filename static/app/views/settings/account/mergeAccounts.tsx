import {createContext, Fragment, useContext} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
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
      <List symbol="colored-numeric">
        <StyledListItem>{t('Generate Verification Code')}</StyledListItem>
        <div>{t(`Check your email for your code. You'll need it in Step 3.`)}</div>
        <ButtonSection>
          <Button priority="primary">Generate verification code</Button>
        </ButtonSection>
        {renderSelectAccounts()}
        <StyledListItem>{t('Enter Your Verification Code')}</StyledListItem>
        <StyledInput type="text" />
        <StyledListItem>{t('Submit')}</StyledListItem>
        <ButtonSection>
          <Button priority="danger">Merge [3] accounts into [michelle.primary]</Button>
        </ButtonSection>
      </List>
    </Fragment>
  );
}

export default MergeAccounts;

function renderSelectAccounts() {
  return (
    <Fragment>
      <StyledListItem>{t('Select Your Accounts')}</StyledListItem>
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
    </Fragment>
  );
}

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

const StyledListItem = styled(ListItem)`
  margin-bottom: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.xl};
  line-height: 1.3;
`;

const ButtonSection = styled('div')`
  margin-top: ${space(1)};
  margin-bottom: ${space(3)};
`;

const StyledInput = styled(Input)`
  margin-top: ${space(1)};
  margin-bottom: ${space(3)};
  flex: 1;
`;
