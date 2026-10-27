import {Fragment, useEffect, useState} from 'react';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import {useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {DateTime} from 'sentry/components/dateTime';
import {makeFeatureFlagSearchKey} from 'sentry/components/events/featureFlags/utils';
import {organizationFlagLogOptions} from 'sentry/components/featureFlags/hooks/useOrganizationFlagLog';
import {getFlagActionLabel, type RawFlag} from 'sentry/components/featureFlags/utils';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

const COLUMNS: TableColumnConfig[] = [
  {key: 'provider', width: 'min-content'},
  {key: 'flag', width: 'minmax(min-content, 1fr)'},
  {key: 'action', width: 'min-content'},
  {key: 'date', width: 'minmax(min-content, 0.4fr)'},
];

interface Props {
  group: Group;
}

export function FlagDetailsDrawerContent({group}: Props) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const {tagKey} = useParams<{tagKey: string}>();
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();

  const {
    data: flagLog,
    isPending,
    isError,
  } = useQuery({
    ...organizationFlagLogOptions({
      organization,
      query: {
        flag: tagKey,
        per_page: 50,
        queryReferrer: 'featureFlagDetailsDrawer',
        sort: '-created_at',
        cursor: location.query.flagDrawerCursor,
      },
    }),
    select: selectJsonWithHeaders,
  });
  const pageLinks = flagLog?.headers.Link ?? null;

  const analyticsArea = useAnalyticsArea();
  useEffect(() => {
    if (!isPending && !isError) {
      trackAnalytics('flags.drawer_details_rendered', {
        organization,
        numLogs: flagLog.json.data.length,
      });
    }
  }, [organization, flagLog?.json.data.length, isPending, isError]);

  return (
    <Fragment>
      <Container flexShrink={0} minWidth="min-content">
        <SimpleTable
          aria-label={t('Feature flag audit logs')}
          columns={COLUMNS}
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>{t('Provider')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Flag Name')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Action')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell sort="desc">{t('Date')}</SimpleTable.HeaderCell>
            </SimpleTable.HeaderRow>
          }
        >
          {isPending ? (
            <SimpleTable.Loading />
          ) : isError ? (
            <SimpleTable.Error
              message={t('There was an error loading feature flag details.')}
            />
          ) : flagLog.json.data.length ? (
            flagLog.json.data.map((flag, i) => {
              const prev = flagLog.json.data[i - 1];
              const showFirstSeen =
                group.firstSeen > flag.createdAt &&
                (i === 0 || (prev && prev.createdAt > group.firstSeen));

              return (
                <Fragment key={`${flag.id}-${i}`}>
                  {showFirstSeen ? <GroupFirstSeenRow group={group} /> : null}
                  <FlagDetailsRow flagValue={flag} />
                </Fragment>
              );
            })
          ) : (
            <SimpleTable.Empty>
              <Stack align="center" gap="xl">
                {t('No audit logs were found for this feature flag.')}
                <LinkButton
                  size="sm"
                  to={{
                    pathname: `${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}`,
                    query: {...location.query, tab: DrawerTab.FEATURE_FLAGS},
                  }}
                >
                  {t('See all flags')}
                </LinkButton>
              </Stack>
            </SimpleTable.Empty>
          )}
        </SimpleTable>
      </Container>
      {isPending || isError || !flagLog.json.data.length ? null : (
        <Pagination
          pageLinks={pageLinks}
          onCursor={(cursor, path, query) => {
            trackAnalytics('flags.logs-paginated', {
              direction: cursor?.endsWith(':1') ? 'prev' : 'next',
              organization,
              surface: analyticsArea,
            });
            navigate({
              pathname: path,
              query: {
                ...query,
                flagDrawerCursor: cursor,
              },
            });
          }}
          size="xs"
        />
      )}
    </Fragment>
  );
}

function FlagDetailsRow({flagValue}: {flagValue: RawFlag}) {
  return (
    <RevealOnHover>
      {props => (
        <SimpleTable.Row {...props}>
          <SimpleTable.RowCell>{flagValue.provider}</SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Text monospace wordBreak="break-word">
              {textProps => <code {...textProps}>{flagValue.flag}</code>}
            </Text>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            {getFlagActionLabel(flagValue.action)}
          </SimpleTable.RowCell>
          <SimpleTable.RowCell position="relative">
            <DateTime date={flagValue.createdAt} year timeZone />
            <FlagValueActionsMenu flagValue={flagValue} />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      )}
    </RevealOnHover>
  );
}

function GroupFirstSeenRow({group}: {group: Group}) {
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell column="span 2">{t('Issue First Seen')}</SimpleTable.RowCell>
      <SimpleTable.RowCell />
      <SimpleTable.RowCell>
        <DateTime date={group.firstSeen} year timeZone />
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

function FlagValueActionsMenu({flagValue}: {flagValue: RawFlag}) {
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();
  const key = flagValue.flag;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <RevealOnHover.Action visible={isVisible}>
      <Flex
        position="absolute"
        top="0"
        bottom="0"
        right="0"
        align="center"
        padding="0 xl"
      >
        <DropdownMenu
          size="xs"
          strategy="fixed"
          onOpenChange={isOpen => setIsVisible(isOpen)}
          trigger={triggerProps => (
            <OverlayTrigger.IconButton
              {...triggerProps}
              aria-label={t('Flag Audit Log Actions Menu')}
              icon={<IconEllipsis />}
            />
          )}
          items={[
            {
              key: 'view-issues-true',
              label: t('Search issues where this flag value is TRUE'),
              to: {
                pathname: `/organizations/${organization.slug}/issues/`,
                query: {query: `${makeFeatureFlagSearchKey(key)}:"true"`},
              },
            },
            {
              key: 'view-issues-false',
              label: t('Search issues where this flag value is FALSE'),
              to: {
                pathname: `/organizations/${organization.slug}/issues/`,
                query: {query: `${makeFeatureFlagSearchKey(key)}:"false"`},
              },
            },
            {
              key: 'copy-value',
              label: t('Copy flag value to clipboard'),
              onAction: () =>
                copy(flagValue.flag, {
                  successMessage: t('Copied flag value to clipboard'),
                }),
            },
          ]}
        />
      </Flex>
    </RevealOnHover.Action>
  );
}
