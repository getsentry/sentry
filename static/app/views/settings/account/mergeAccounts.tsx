import {createContext, Fragment, useContext, useState} from 'react';
import styled from '@emotion/styled';

// import {addErrorMessage} from 'sentry/actionCreators/indicator';
// import type {RequestOptions} from 'sentry/api';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TimeSince from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {UserWithOrganizations} from 'sentry/types/user';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
// import useApi from 'sentry/utils/useApi';
import {useUser} from 'sentry/utils/useUser';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const UserContext = createContext<boolean>(false);

const ENDPOINT = '/auth/merge-accounts/';

function MergeAccounts() {
  // const queryClient = useQueryClient();
  const user = useUser();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const selectUser = (newUserId: string) =>
    setSelectedUserIds(prevSelectedUserIds =>
      prevSelectedUserIds.includes(newUserId)
        ? prevSelectedUserIds.filter(i => i !== newUserId)
        : [...prevSelectedUserIds, newUserId]
    );

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
        <RenderSelectAccounts onSelect={selectUser} />
        <StyledListItem>{t('Enter Your Verification Code')}</StyledListItem>
        <StyledInput type="text" />
        <StyledListItem>{t('Submit')}</StyledListItem>
        <ButtonSection>
          <Button priority="danger">
            {tct('Merge [numAccounts] accounts into [name]', {
              numAccounts: selectedUserIds.length,
              name: user.name,
            })}
          </Button>
        </ButtonSection>
      </List>
    </Fragment>
  );
}

export default MergeAccounts;

function makeMergeAccountsEndpointKey(): ApiQueryKey {
  return [ENDPOINT];
}

function RenderSelectAccounts({onSelect}: RenderSelectAccountsProps) {
  const signedInUser = useUser();
  // const api = useApi();
  // const [isUpdating, setIsUpdating] = useState(false);
  const {
    data: users = [],
    isPending,
    isError,
    refetch,
  } = useApiQuery<UserWithOrganizations[]>(makeMergeAccountsEndpointKey(), {
    staleTime: 0,
    gcTime: 0,
  });

  if (isPending) {
    return (
      <Panel>
        <PanelHeader>{t('Placeholder')}</PanelHeader>
        <PanelBody>
          <LoadingIndicator />
        </PanelBody>
      </Panel>
    );
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  // function doApiCall(endpoint: string, requestParams: RequestOptions) {
  //   setIsUpdating(true);
  //   api
  //     .requestPromise(endpoint, requestParams)
  //     .catch(err => {
  //       if (err?.responseJSON?.data) {
  //         addErrorMessage(err.responseJSON.data);
  //       }
  //     })
  //     .finally(() => {
  //       refetch();
  //       setIsUpdating(false);
  //     });
  // }

  const currentAccount = users.filter(({id}) => id === signedInUser.id);
  const otherAccounts = users.filter(({id}) => id !== signedInUser.id);

  return (
    <Fragment>
      <StyledListItem>{t('Select Your Accounts')}</StyledListItem>
      <TextBlock>
        {t(`Select the accounts that you want to merge into your currently active account,
          then confirm and merge. The accounts that you do not select will be deleted.`)}
      </TextBlock>
      <TextBlock>{t(`Your currently active account:`)}</TextBlock>
      <UserContext value>
        <Users users={currentAccount} onSelect={onSelect} />
      </UserContext>
      <TextBlock>{t(`Your other accounts:`)}</TextBlock>
      <UserContext value={false}>
        <Users users={otherAccounts} onSelect={onSelect} />
      </UserContext>
    </Fragment>
  );
}

type RenderSelectAccountsProps = {
  onSelect: (newUserId: string) => void;
};

type UserRowProps = {
  id: string;
  lastSeen: string;
  name: string;
  onSelect: (newUserId: string) => void;
  organizations: string;
};

type UserProps = {
  onSelect: (newUserId: string) => void;
  users: UserWithOrganizations[];
};

function Users({users, onSelect}: UserProps) {
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
          {users.map(userObj => (
            <UserRow
              onSelect={onSelect}
              key={userObj.id}
              id={userObj.id}
              name={userObj.name}
              lastSeen={userObj.lastActive}
              organizations={userObj.organizations.join(', ')}
            />
          ))}
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
        {users.map(userObj => (
          <UserRow
            onSelect={onSelect}
            key={userObj.id}
            id={userObj.id}
            name={userObj.name}
            lastSeen={userObj.lastActive}
            organizations={userObj.organizations.join(', ')}
          />
        ))}
      </PanelBody>
    </Panel>
  );
}

function UserRow({id, name, lastSeen, organizations, onSelect}: UserRowProps) {
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
      <div> {organizations} </div>
      {isPrimaryUser ? null : (
        <div>
          <input
            type="checkbox"
            name="user"
            value={name}
            onChange={() => onSelect(id)}
            style={{margin: 5}}
          />
        </div>
      )}
    </UserPanelItem>
  );
}

const tableLayout = `
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
  font-size: ${p => p.theme.fontSize.sm};
`;

const UserPanelHeader = styled(PanelHeader)`
  ${tableLayout}
  justify-content: initial;
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
