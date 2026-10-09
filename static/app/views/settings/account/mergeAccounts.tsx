import {Fragment, useId, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Input} from '@sentry/scraps/input';
import {Container} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {List} from 'sentry/components/list';
import {ListItem} from 'sentry/components/list/listItem';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types/user';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, setApiQueryData, useApiQuery} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useUser} from 'sentry/utils/useUser';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

const ENDPOINT = getApiUrl('/auth-v2/merge-accounts/');
const VERIFICATION_CODE_ENDPOINT = getApiUrl('/auth-v2/user-merge-verification-codes/');

const ORGANIZATIONS_COLUMN_WIDTH = 160;
const MERGE_COLUMN_WIDTH = 90;

const OTHER_ACCOUNT_COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(150px, 1fr)'},
  {key: 'lastActive', width: 160},
  {key: 'organizations', width: ORGANIZATIONS_COLUMN_WIDTH},
  {key: 'merge', width: MERGE_COLUMN_WIDTH},
];

const CURRENT_ACCOUNT_COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(150px, 1fr)'},
  {key: 'lastActive', width: 160},
  {key: 'organizations', width: ORGANIZATIONS_COLUMN_WIDTH + MERGE_COLUMN_WIDTH},
];

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
            "Only one account was found with your primary email address. You're all set."
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
        <div>{t("Check your email for your code. You'll need it in Step 3.")}</div>
        <ButtonSection>
          <Button
            variant="primary"
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
            variant="danger"
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
  const currentAccountLabelId = useId();
  const otherAccountsLabelId = useId();

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
      <TextBlock id={currentAccountLabelId}>
        {t('Your currently active account:')}
      </TextBlock>
      <Container marginBottom="xl">
        <SimpleTable
          aria-labelledby={currentAccountLabelId}
          columns={CURRENT_ACCOUNT_COLUMNS}
          flexibleLastColumn={false}
          scrollable
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Last Active')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Organizations')}</SimpleTable.HeaderCell>
            </SimpleTable.HeaderRow>
          }
        >
          {currentAccount.map(user => (
            <SimpleTable.Row key={user.id}>
              <NameCell user={user} />
              <SimpleTable.RowCell>{t('Currently active')}</SimpleTable.RowCell>
              <OrganizationsCell user={user} />
            </SimpleTable.Row>
          ))}
        </SimpleTable>
      </Container>
      <TextBlock id={otherAccountsLabelId}>{t('Your other accounts:')}</TextBlock>
      <Container marginBottom="xl">
        <SimpleTable
          aria-labelledby={otherAccountsLabelId}
          columns={OTHER_ACCOUNT_COLUMNS}
          flexibleLastColumn={false}
          scrollable
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Last Active')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Organizations')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Merge')}</SimpleTable.HeaderCell>
            </SimpleTable.HeaderRow>
          }
        >
          {otherAccounts.map(user => (
            <SimpleTable.Row key={user.id}>
              <NameCell user={user} />
              <SimpleTable.RowCell>
                {user.lastActive === '' ? (
                  t('Never')
                ) : (
                  <Text size="sm">
                    <TimeSince date={user.lastActive} />
                  </Text>
                )}
              </SimpleTable.RowCell>
              <OrganizationsCell user={user} />
              <SimpleTable.RowCell>
                <Checkbox
                  aria-label={t('Merge %s', user.name)}
                  onChange={() => onSelect(user.id)}
                  checked={selectedUsers.includes(user.id)}
                />
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          ))}
        </SimpleTable>
      </Container>
    </Fragment>
  );
}

function NameCell({user}: {user: UserWithOrganizations}) {
  return (
    <SimpleTable.RowCell>
      <Text bold wordBreak="break-word">
        {user.name}
      </Text>
    </SimpleTable.RowCell>
  );
}

function OrganizationsCell({user}: {user: UserWithOrganizations}) {
  return (
    <SimpleTable.RowCell>
      <Text wordBreak="break-word">{user.organizations.join(', ')}</Text>
    </SimpleTable.RowCell>
  );
}

const StyledListItem = styled(ListItem)`
  margin-bottom: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.font.size.xl};
  line-height: 1.3;
`;

const ButtonSection = styled('div')`
  margin-top: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const StyledInput = styled(Input)`
  margin-top: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space['2xl']};
  flex: 1;
`;
