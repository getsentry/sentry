import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import upperFirst from 'lodash/upperFirst';

import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Tag} from 'sentry/components/core/badge/tag';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {DateTime} from 'sentry/components/dateTime';
import LoadingError from 'sentry/components/loadingError';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Timeline} from 'sentry/components/timeline';
import {IconCircleFill} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {AuditLog} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {getTimeFormat} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

function LogUsername({logEntryUser}: {logEntryUser: User | undefined}) {
  if (logEntryUser?.isSuperuser) {
    return (
      <Flex align="center" gap="md">
        <Text variant="muted" size="sm">
          {logEntryUser.name}
        </Text>
        <Tag variant="muted">{t('Sentry Staff')}</Tag>
      </Flex>
    );
  }

  if (logEntryUser?.name !== 'Sentry' && logEntryUser !== undefined) {
    return (
      <Text variant="muted" size="sm">
        {logEntryUser.name}
      </Text>
    );
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

function SkeletonEntry() {
  return (
    <Timeline.Item
      title={<Placeholder width="100px" height="20px" />}
      icon={<IconCircleFill />}
    >
      <Placeholder width="300px" height="36px" />
    </Timeline.Item>
  );
}

export default function UsageLog() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
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

  const eventNames = useMemoWithPrevious<string[] | null>(
    previous => auditLogs?.eventNames ?? previous,
    [auditLogs?.eventNames]
  );

  const handleEventFilter = (value: string | undefined) => {
    if (typeof value === 'string') {
      navigate({
        pathname: location.pathname,
        query: {...location.query, event: value, cursor: undefined},
      });
    } else {
      // Clear filters
      navigate({
        pathname: location.pathname,
        query: {...location.query, event: undefined, cursor: undefined},
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

  const usageLogContent = (
    <Fragment>
      <Grid gap="2xl" flow="row">
        <CompactSelect
          searchable
          clearable
          menuTitle={t('Subscription Actions')}
          options={eventNameOptions}
          value={selectedEventName}
          onChange={option => {
            handleEventFilter(option?.value);
          }}
          triggerProps={{
            size: 'sm',
            children: selectedEventName ? undefined : t('Select Action'),
          }}
        />
        {isError ? (
          <LoadingError onRetry={refetch} />
        ) : auditLogs?.rows?.length === 0 ? (
          <Text size="md">{t('No entries available.')}</Text>
        ) : (
          <Timeline.Container>
            {isPending
              ? Array.from({length: 50}).map((_, index) => <SkeletonEntry key={index} />)
              : auditLogs?.rows.map((entry, index) => (
                  <Timeline.Item
                    key={entry.id}
                    colorConfig={{
                      icon: index === 0 ? theme.active : theme.colors.gray400,
                      iconBorder: index === 0 ? theme.active : theme.colors.gray400,
                      title: theme.tokens.content.primary,
                    }}
                    icon={<IconCircleFill />}
                    title={formatEntryTitle(entry.event)}
                    titleTrailingItems={
                      <Fragment>
                        <Text size="md" variant="muted" bold>
                          {' ・ '}
                        </Text>
                        <Grid columns="max-content auto" gap="md">
                          <DateTime
                            format={`MMM D, YYYY ・ ${getTimeFormat({timeZone: true})}`}
                            date={entry.dateCreated}
                            style={{fontSize: theme.fontSize.sm}}
                          />
                        </Grid>
                        {entry.actor && entry.actor.name !== 'Sentry' && (
                          <Fragment>
                            <Text size="sm" variant="muted" bold>
                              {' ・ '}
                            </Text>
                            <LogUsername logEntryUser={entry.actor} />
                          </Fragment>
                        )}
                      </Fragment>
                    }
                  >
                    <Container paddingBottom="xl" maxWidth="800px">
                      <Text variant="muted" size="md">
                        {formatEntryMessage(entry.note)}
                      </Text>
                    </Container>
                  </Timeline.Item>
                ))}
          </Timeline.Container>
        )}
      </Grid>
      <Pagination pageLinks={getResponseHeader?.('Link')} onCursor={handleCursor} />
    </Fragment>
  );

  return (
    <SubscriptionPageContainer background="primary">
      <SentryDocumentTitle title={t('Activity Logs')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('Activity Logs')} />
      {usageLogContent}
    </SubscriptionPageContainer>
  );
}
