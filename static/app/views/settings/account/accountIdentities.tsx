import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {disconnectIdentity} from 'sentry/actionCreators/account';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {Tag} from 'sentry/components/core/badge/tag';
import {DateTime} from 'sentry/components/dateTime';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {UserIdentityConfig} from 'sentry/types/auth';
import {UserIdentityCategory, UserIdentityStatus} from 'sentry/types/auth';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import IdentityIcon from 'sentry/views/settings/components/identityIcon';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const EMPTY_ARRAY: any = [];
const IDENTITIES_ENDPOINT = '/users/me/user-identities/';

function itemOrder(a: UserIdentityConfig, b: UserIdentityConfig) {
  function categoryRank(c: UserIdentityConfig) {
    return [
      UserIdentityCategory.GLOBAL_IDENTITY,
      UserIdentityCategory.SOCIAL_IDENTITY,
      UserIdentityCategory.ORG_IDENTITY,
    ].indexOf(c.category);
  }

  if (a.provider.name !== b.provider.name) {
    return a.provider.name < b.provider.name ? -1 : 1;
  }
  if (a.category !== b.category) {
    return categoryRank(a) - categoryRank(b);
  }
  const nameA = a.organization?.name ?? '';
  const nameB = b.organization?.name ?? '';
  return nameA.localeCompare(nameB);
}

interface IdentityItemProps {
  identity: UserIdentityConfig;
  onDisconnect: (identity: UserIdentityConfig) => void;
}

function IdentityItem({identity, onDisconnect}: IdentityItemProps) {
  return (
    <IdentityPanelItem key={`${identity.category}:${identity.id}`}>
      <InternalContainer>
        <IdentityIcon providerId={identity.provider.key} />
        <IdentityText isSingleLine={!identity.dateAdded}>
          <IdentityName>{identity.provider.name}</IdentityName>
          {identity.dateAdded && <IdentityDateTime date={moment(identity.dateAdded)} />}
        </IdentityText>
      </InternalContainer>
      <InternalContainer>
        <TagWrapper>
          {identity.category === UserIdentityCategory.SOCIAL_IDENTITY && (
            <Tag type="default">{t('Legacy')}</Tag>
          )}
          {identity.category !== UserIdentityCategory.ORG_IDENTITY && (
            <Tag type="default">{identity.isLogin ? t('Sign In') : t('Integration')}</Tag>
          )}
          {identity.organization && (
            <Tag type="highlight">{identity.organization.slug}</Tag>
          )}
        </TagWrapper>

        {identity.status === UserIdentityStatus.CAN_DISCONNECT ? (
          <Confirm
            onConfirm={() => onDisconnect(identity)}
            priority="danger"
            confirmText={t('Disconnect')}
            message={
              <Fragment>
                <Alert.Container>
                  <Alert type="error" showIcon>
                    {tct('Disconnect Your [provider] Identity?', {
                      provider: identity.provider.name,
                    })}
                  </Alert>
                </Alert.Container>
                <TextBlock>
                  {identity.isLogin
                    ? t(
                        'After disconnecting, you will need to use a password or another identity to sign in.'
                      )
                    : t("This action can't be undone.")}
                </TextBlock>
              </Fragment>
            }
          >
            <Button size="sm">{t('Disconnect')}</Button>
          </Confirm>
        ) : (
          <Button
            size="sm"
            disabled
            title={
              identity.status === UserIdentityStatus.NEEDED_FOR_GLOBAL_AUTH
                ? t(
                    'You need this identity to sign into your account. If you want to disconnect it, set a password first.'
                  )
                : identity.status === UserIdentityStatus.NEEDED_FOR_ORG_AUTH
                  ? t('You need this identity to access your organization.')
                  : null
            }
          >
            {t('Disconnect')}
          </Button>
        )}
      </InternalContainer>
    </IdentityPanelItem>
  );
}

function AccountIdentities() {
  const queryClient = useQueryClient();
  const {
    data: identities = EMPTY_ARRAY,
    isPending,
    isError,
    refetch,
  } = useApiQuery<UserIdentityConfig[]>([IDENTITIES_ENDPOINT], {
    staleTime: 0,
  });

  const appIdentities = useMemo(
    () =>
      identities
        // @ts-expect-error TS(7006): Parameter 'identity' implicitly has an 'any' type.
        .filter(identity => identity.category !== UserIdentityCategory.ORG_IDENTITY)
        .sort(itemOrder),
    [identities]
  );

  const orgIdentities = useMemo(
    () =>
      identities
        // @ts-expect-error TS(7006): Parameter 'identity' implicitly has an 'any' type.
        .filter(identity => identity.category === UserIdentityCategory.ORG_IDENTITY)
        .sort(itemOrder),
    [identities]
  );

  const handleDisconnect = useCallback(
    (identity: UserIdentityConfig) => {
      disconnectIdentity(identity, () => {
        setApiQueryData(queryClient, [IDENTITIES_ENDPOINT], oldData => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }

          return oldData.filter(i => i.id !== identity.id);
        });
      });
    },
    [queryClient]
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Identities')} />
      <SettingsPageHeader title="Identities" />

      <Panel>
        <PanelHeader>{t('Application Identities')}</PanelHeader>
        <PanelBody>
          {!appIdentities.length ? (
            <EmptyMessage>
              {t(
                'There are no application identities associated with your Sentry account'
              )}
            </EmptyMessage>
          ) : (
            // @ts-expect-error TS(7006): Parameter 'identity' implicitly has an 'any' type.
            appIdentities.map(identity => (
              <IdentityItem
                key={identity.id}
                identity={identity}
                onDisconnect={handleDisconnect}
              />
            ))
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>{t('Organization Identities')}</PanelHeader>
        <PanelBody>
          {!orgIdentities.length ? (
            <EmptyMessage>
              {t(
                'There are no organization identities associated with your Sentry account'
              )}
            </EmptyMessage>
          ) : (
            // @ts-expect-error TS(7006): Parameter 'identity' implicitly has an 'any' type.
            orgIdentities.map(identity => (
              <IdentityItem
                key={identity.id}
                identity={identity}
                onDisconnect={handleDisconnect}
              />
            ))
          )}
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

const IdentityPanelItem = styled(PanelItem)`
  align-items: center;
  justify-content: space-between;
`;

const InternalContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const IdentityText = styled('div')<{isSingleLine?: boolean}>`
  height: 36px;
  display: flex;
  flex-direction: column;
  justify-content: ${p => (p.isSingleLine ? 'center' : 'space-between')};
  margin-left: ${space(1.5)};
`;
const IdentityName = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
`;
const IdentityDateTime = styled(DateTime)`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  color: ${p => p.theme.subText};
`;

const TagWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-grow: 1;
  margin-right: ${space(1)};
  gap: ${space(0.75)};
`;

export default AccountIdentities;
