import {createContext, Fragment, useContext, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Input} from '@sentry/scraps/input';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
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
import type {AvatarUser} from 'sentry/types/user';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {
  fetchMutation,
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useUser} from 'sentry/utils/useUser';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const IsPrimaryUserContext = createContext<boolean>(false);

const ENDPOINT = '/auth-v2/merge-accounts/';
const VERIFICATION_CODE_ENDPOINT = '/auth-v2/user-merge-verification-codes/';

interface UserWithOrganizations extends Omit<AvatarUser, 'options'> {
  lastActive: string;
  organizations: string[];
}

function MergeAccounts() {
  const {
    data: users = [],
    isPending,
    isError,
    refetch,
  } = useApiQuery<UserWithOrganizations[]>(makeMergeAccountsEndpointKey(), {
    staleTime: 0,
  });
  const user = useUser();
  const queryClient = useQueryClient();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [tokenValue, setTokenValue] = useState('');
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);

  const selectUser = (newUserId: string) =>
    setSelectedUserIds(prevSelectedUserIds =>
      prevSelectedUserIds.includes(newUserId)
        ? prevSelectedUserIds.filter(i => i !== newUserId)
        : [...prevSelectedUserIds, newUserId]
    );

  type SubmitVariables = {
    idsToDelete: string[];
    idsToMerge: string[];
    verificationCode: string;
  };
  const {isPending: isSubmitPending, mutate: submit} = useMutation<
    UserWithOrganizations[],
    RequestError,
    SubmitVariables
  >({
    mutationFn: ({idsToMerge, idsToDelete, verificationCode}: SubmitVariables) => {
      return fetchMutation({
        url: ENDPOINT,
        method: 'POST',
        data: {
          idsToMerge,
          idsToDelete,
          verificationCode,
        },
      });
    },
    onSuccess: data => {
      addSuccessMessage(t('Accounts merged!'));
      setSelectedUserIds([]);
      setApiQueryData<UserWithOrganizations[]>(
        queryClient,
        makeMergeAccountsEndpointKey(),
        data
      );
    },
    onError: (err: RequestError) => {
      if (err.responseJSON && !('raw' in err.responseJSON)) {
        addErrorMessage(
          Object.values(err.responseJSON ?? {})
            .flat()
            .join(' ')
        );
      }
    },
  });

  const {mutate: postVerificationCode} = useMutation({
    mutationFn: () => {
      return fetchMutation({
        url: VERIFICATION_CODE_ENDPOINT,
        method: 'POST',
        data: {},
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Verification code posted!'));
      setVerificationCodeSent(true);
    },
  });

  const handleSubmit = (idsToMerge: string[], verificationCode: string) => {
    const userIds = users.map(item => item.id);
    const idsToDelete = userIds.filter(
      item => !idsToMerge.includes(item) && item !== user.id
    );
    submit({idsToMerge, idsToDelete, verificationCode});
  };

  const handlePostVerificationCode = () => {
    postVerificationCode();
  };

  if (isPending) {
    return (
      <Fragment>
        <SentryDocumentTitle title={t('Merge Accounts')} />
        <SettingsPageHeader title={t('Merge Accounts')} />
        <LoadingIndicator />
      </Fragment>
    );
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (users.length === 1) {
    return (
      <Fragment>
        <SentryDocumentTitle title={t('Merge Accounts')} />
        <SettingsPageHeader title={t('Merge Accounts')} />
        <div>
          {t(
            `Only one account was found with your primary email address. You're all set.`
          )}
        </div>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Merge Accounts')} />
      <SettingsPageHeader title={t('Merge Accounts')} />
      <List symbol="colored-numeric">
        <StyledListItem>{t('Generate Verification Code')}</StyledListItem>
        <div>{t(`Check your email for your code. You'll need it in Step 3.`)}</div>
        <ButtonSection>
          <Button
            priority="primary"
            disabled={verificationCodeSent}
            onClick={() => handlePostVerificationCode()}
          >
            {t('Generate verification code')}
          </Button>
        </ButtonSection>
        <AccountSelection
          users={users}
          onSelect={selectUser}
          selectedUsers={selectedUserIds}
        />
        <StyledListItem>{t('Enter Your Verification Code and Submit')}</StyledListItem>
        <div>
          {tct(
            'Merge [numMergeAccounts] account(s) into [name] and delete [numDeleteAccounts] account(s)',
            {
              numMergeAccounts: selectedUserIds.length,
              name: user.name,
              numDeleteAccounts: users.length - selectedUserIds.length - 1,
            }
          )}
        </div>
        <StyledInput
          type="text"
          value={tokenValue}
          onChange={e => setTokenValue(e.target.value)}
        />
        <div>
          <Button
            priority="danger"
            onClick={() => handleSubmit(selectedUserIds, tokenValue)}
            disabled={isSubmitPending}
          >
            {t('Submit')}
          </Button>
        </div>
      </List>
    </Fragment>
  );
}

export default MergeAccounts;

function makeMergeAccountsEndpointKey(): ApiQueryKey {
  return [ENDPOINT];
}

type AccountSelectionProps = {
  onSelect: (newUserId: string) => void;
  selectedUsers: string[];
  users: UserWithOrganizations[];
};

function AccountSelection({users, onSelect, selectedUsers}: AccountSelectionProps) {
  const signedInUser = useUser();

  const currentAccount = users.filter(({id}) => id === signedInUser.id);
  const otherAccounts = users.filter(({id}) => id !== signedInUser.id);

  return (
    <Fragment>
      <StyledListItem>{t('Select Your Accounts')}</StyledListItem>
      <TextBlock>
        {tct(
          `Select the accounts that you want to merge into your currently active account,
          then confirm and merge. [strong:The accounts that you do not select will be deleted!]`,
          {
            strong: <strong />,
          }
        )}
      </TextBlock>
      <TextBlock>{t(`Your currently active account:`)}</TextBlock>
      <IsPrimaryUserContext value>
        <Users users={currentAccount} onSelect={onSelect} selectedUsers={selectedUsers} />
      </IsPrimaryUserContext>
      <TextBlock>{t(`Your other accounts:`)}</TextBlock>
      <IsPrimaryUserContext value={false}>
        <Users users={otherAccounts} onSelect={onSelect} selectedUsers={selectedUsers} />
      </IsPrimaryUserContext>
    </Fragment>
  );
}

type UserProps = {
  onSelect: (newUserId: string) => void;
  selectedUsers: string[];
  users: UserWithOrganizations[];
};

function Users({users, onSelect, selectedUsers}: UserProps) {
  const isPrimaryUser = useContext(IsPrimaryUserContext);
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
              selectedUsers={selectedUsers}
              onSelect={onSelect}
              key={userObj.id}
              user={userObj}
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
            selectedUsers={selectedUsers}
            key={userObj.id}
            user={userObj}
          />
        ))}
      </PanelBody>
    </Panel>
  );
}

type UserRowProps = {
  onSelect: (newUserId: string) => void;
  selectedUsers: string[];
  user: UserWithOrganizations;
};

function UserRow({user, onSelect, selectedUsers}: UserRowProps) {
  const isPrimaryUser = useContext(IsPrimaryUserContext);

  return (
    <UserPanelItem>
      <Name>{user.name}</Name>
      {isPrimaryUser ? (
        t('Currently active')
      ) : user.lastActive === '' ? (
        t('Never')
      ) : (
        <div>
          <StyledTimeSince date={user.lastActive} />
        </div>
      )}
      <div> {user.organizations.join(', ')} </div>
      {isPrimaryUser ? null : (
        <div>
          <Checkbox
            role="checkbox"
            name={user.name}
            value={user.name}
            onChange={() => onSelect(user.id)}
            style={{margin: 5}}
            checked={selectedUsers.includes(user.id)}
          />
        </div>
      )}
    </UserPanelItem>
  );
}

const tableLayout = css`
  display: grid;
  grid-template-columns: auto 140px 140px 60px;
  gap: ${space(1)};
  align-items: center;
`;

const UserPanelItem = styled(PanelItem)`
  ${tableLayout};
`;

const Name = styled('div')`
  margin-bottom: ${space(0.5)};
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const StyledTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.font.size.sm};
`;

const UserPanelHeader = styled(PanelHeader)`
  ${tableLayout}
  justify-content: initial;
`;

const StyledListItem = styled(ListItem)`
  margin-bottom: ${space(0.5)};
  font-size: ${p => p.theme.font.size.xl};
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
