import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import upperFirst from 'lodash/upperFirst';

import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {DateTime} from 'sentry/components/dateTime';
import LoadingError from 'sentry/components/loadingError';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {AuditLog} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {shouldUse24Hours} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {hasNewBillingUI} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

import SubscriptionHeader from './subscriptionHeader';

const avatarStyle = {
  width: 36,
  height: 36,
  marginRight: space(1),
};

function LogAvatar({logEntryUser}: {logEntryUser: User | undefined}) {
  // Display Sentry's avatar for system or superuser-initiated events
  if (
    logEntryUser?.isSuperuser ||
    (logEntryUser?.name === 'Sentry' && logEntryUser?.email === undefined)
  ) {
    return <SentryAvatar type="system" size={36} />;
  }
  // Display user's avatar for non-superusers-initiated events
  if (logEntryUser !== undefined) {
    return <UserAvatar style={avatarStyle} user={logEntryUser} />;
  }
  return null;
}

function LogUsername({logEntryUser}: {logEntryUser: User | undefined}) {
  if (logEntryUser?.isSuperuser) {
    return (
      <StaffNote>
        {logEntryUser.name}
        <Tag type="default">{t('Sentry Staff')}</Tag>
      </StaffNote>
    );
  }
  if (logEntryUser?.name !== 'Sentry' && logEntryUser !== undefined) {
    return <Note>{logEntryUser.name}</Note>;
  }
  return null;
}

const formatEntryTitle = (name: string) => {
  const spaceName = name.replace(/-|\./gm, ' ');
  let capitalizeName = spaceName.replace(/(^\w)|([-\s]\w)/g, match =>
    match.toUpperCase()
  );
  // Keep hypens back in pay-as-you-go title
  capitalizeName = capitalizeName.replace(/pay as you go/i, 'Pay-as-you-go');
  // Keep hypens in on-demand title
  capitalizeName = capitalizeName.replace(/ondemand/i, 'On-demand');
  return capitalizeName;
};

const formatEntryMessage = (message: string) => {
  return upperFirst(message);
};

interface UsageLogs {
  eventNames: string[];
  rows: AuditLog[];
}

type Props = {
  location: Location;
  subscription: Subscription;
};

function UsageLog({location, subscription}: Props) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {
    data: auditLogs,
    isPending,
    isError,
    getResponseHeader,
    refetch,
  } = useApiQuery<UsageLogs>(
    [
      `/customers/${organization.slug}/subscription/usage-logs/`,
      {
        method: 'GET',
        query: {
          ...location.query,
        },
      },
    ],
    {staleTime: 0}
  );

  //
  const eventNames = useMemoWithPrevious<string[] | null>(
    previous => auditLogs?.eventNames ?? previous,
    [auditLogs?.eventNames]
  );

  const handleEventFilter = (value: string | null) => {
    if (value === null) {
      // Clear filters
      navigate({
        pathname: location.pathname,
        query: {...location.query, event: undefined, cursor: undefined},
      });
    } else {
      navigate({
        pathname: location.pathname,
        query: {...location.query, event: value, cursor: undefined},
      });
    }

    trackGetsentryAnalytics('subscription_page.usagelog_filter.clicked', {
      organization,
      selection: value ?? 'clear',
    });
  };

  const handleCursor: CursorHandler = resultsCursor => {
    navigate({
      pathname: location.pathname,
      query: {...location.query, cursor: resultsCursor},
    });
  };

  const eventNameOptions =
    eventNames?.map(type => ({
      label: formatEntryTitle(type),
      value: type,
    })) ?? [];
  const selectedEventName = decodeScalar(location.query.event);
  const isNewBillingUI = hasNewBillingUI(organization);

  const usageLogContent = (
    <Fragment>
      <UsageLogContainer>
        <CompactSelect
          searchable
          clearable
          menuTitle={t('Subscription Actions')}
          options={eventNameOptions}
          defaultValue={selectedEventName}
          onClear={() => handleEventFilter(null)}
          onChange={option => {
            handleEventFilter(option.value);
          }}
          triggerProps={{
            size: 'sm',
            children: selectedEventName ? undefined : t('Select Action'),
          }}
        />
        {isError ? (
          <LoadingError onRetry={refetch} />
        ) : (
          <UsageTable
            headers={[t('Action'), t('Time')]}
            isEmpty={auditLogs?.rows && auditLogs?.rows.length === 0}
            emptyMessage={t('No entries available')}
            isLoading={isPending}
          >
            {auditLogs?.rows.map(entry => (
              <Fragment key={entry.id}>
                <UserInfo>
                  <div>
                    <LogAvatar logEntryUser={entry.actor} />
                  </div>
                  <NoteContainer>
                    <LogUsername logEntryUser={entry.actor} />
                    <Title>{formatEntryTitle(entry.event)}</Title>
                    <Note>{formatEntryMessage(entry.note)}</Note>
                  </NoteContainer>
                </UserInfo>

                <TimestampInfo>
                  <DateTime dateOnly date={entry.dateCreated} />
                  <DateTime
                    timeOnly
                    format={shouldUse24Hours() ? 'HH:mm zz' : 'LT zz'}
                    date={entry.dateCreated}
                  />
                </TimestampInfo>
              </Fragment>
            ))}
          </UsageTable>
        )}
      </UsageLogContainer>
      <Pagination pageLinks={getResponseHeader?.('Link')} onCursor={handleCursor} />
    </Fragment>
  );

  if (!isNewBillingUI) {
    return (
      <SubscriptionPageContainer background="primary" organization={organization}>
        <SubscriptionHeader subscription={subscription} organization={organization} />
        {usageLogContent}
      </SubscriptionPageContainer>
    );
  }

  return (
    <SubscriptionPageContainer background="primary" organization={organization}>
      <SentryDocumentTitle title={t('Activity Logs')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('Activity Logs')} />
      {usageLogContent}
    </SubscriptionPageContainer>
  );
}

export default withSubscription(UsageLog);
export {UsageLog};

const SentryAvatar = styled(ActivityAvatar)`
  margin-right: ${space(1)};
`;

const Note = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  word-break: break-word;
`;

const StaffNote = styled(Note)`
  display: flex;
  gap: ${space(1)};
  line-height: 1.5;
`;

const UsageLogContainer = styled('div')`
  display: grid;
  grid-auto-flow: row;
  gap: ${space(3)};
`;

const UsageTable = styled(PanelTable)`
  box-shadow: inset 0px -1px 0px ${p => p.theme.gray200};
`;

const UserInfo = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  min-width: 250px;
  display: flex;
`;

const NoteContainer = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
`;

const TimestampInfo = styled('div')`
  display: grid;
  grid-template-columns: max-content auto;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSize.md};
  align-content: center;
`;
