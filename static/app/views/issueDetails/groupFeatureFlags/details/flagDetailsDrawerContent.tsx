import {Fragment, useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import {useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import {Text} from '@sentry/scraps/text';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {DateTime} from 'sentry/components/dateTime';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {makeFeatureFlagSearchKey} from 'sentry/components/events/featureFlags/utils';
import {organizationFlagLogOptions} from 'sentry/components/featureFlags/hooks/useOrganizationFlagLog';
import {getFlagActionLabel, type RawFlag} from 'sentry/components/featureFlags/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconArrow, IconEllipsis} from 'sentry/icons';
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

interface Props {
  group: Group;
}

export function FlagDetailsDrawerContent({group}: Props) {
  const theme = useTheme();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {tagKey} = useParams<{tagKey: string}>();
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();

  const sortArrow = <IconArrow variant="muted" size="xs" direction="down" />;

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

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError || !flagLog) {
    return (
      <LoadingError message={t('There was an error loading feature flag details.')} />
    );
  }

  if (!flagLog.json.data.length) {
    return (
      <Stack align="center">
        <Container padding="2xl">
          <EmptyStateWarning withIcon={false} small>
            {t('No audit logs were found for this feature flag.')}
          </EmptyStateWarning>
        </Container>
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
    );
  }

  let rowIndex = 0;

  return (
    <Fragment>
      <Grid
        columns="0.4fr 0.7fr 0.3fr 0.5fr min-content"
        gap={{zero: 'xs md', '5xl': 'xs xl'}}
        position="relative"
        left={`-${theme.space.md}`}
        width={`calc(100% + ${theme.space.md} + ${theme.space.md})`}
      >
        <Grid column="1 / -1" columns="subgrid" borderBottom="primary" margin="0 md">
          <Text as="div" wrap="nowrap" variant="muted" bold>
            {t('Provider')}
          </Text>
          <Text as="div" wrap="nowrap" variant="muted" bold>
            {t('Flag Name')}
          </Text>
          <Text as="div" wrap="nowrap" variant="muted" bold>
            {t('Action')}
          </Text>
          <Text as="div" wrap="nowrap" variant="muted" bold>
            {sortArrow}
            {t('Date')}
          </Text>
        </Grid>
        <Grid column="1 / -1" columns="subgrid">
          {flagLog.json.data.map((flag, i) => {
            const prev = flagLog.json.data[i - 1];
            const showFirstSeen =
              group.firstSeen > flag.createdAt &&
              (i === 0 || (prev && prev.createdAt > group.firstSeen));
            const firstSeenRowIndex = showFirstSeen ? rowIndex++ : undefined;
            const flagRowIndex = rowIndex++;

            return (
              <Fragment key={`${flag.id}-${i}`}>
                {firstSeenRowIndex === undefined ? null : (
                  <GroupFirstSeenRow
                    group={group}
                    striped={firstSeenRowIndex % 2 === 1}
                  />
                )}
                <FlagDetailsRow flagValue={flag} striped={flagRowIndex % 2 === 1} />
              </Fragment>
            );
          })}
        </Grid>
      </Grid>
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
    </Fragment>
  );
}

function FlagDetailsRow({flagValue, striped}: {flagValue: RawFlag; striped: boolean}) {
  return (
    <RevealOnHover>
      {props => (
        <Grid
          {...props}
          column="1 / -1"
          columns="subgrid"
          align="center"
          radius="xs"
          padding="2xs md"
          background={striped ? 'secondary' : undefined}
        >
          <Text as="div" align="left" variant="inherit">
            {flagValue.provider}
          </Text>
          <Text as="div" align="left" variant="inherit">
            <code>{flagValue.flag}</code>
          </Text>
          {getFlagActionLabel(flagValue.action)}
          <DateTime date={flagValue.createdAt} year timeZone />
          <FlagValueActionsMenu flagValue={flagValue} />
        </Grid>
      )}
    </RevealOnHover>
  );
}

function GroupFirstSeenRow({group, striped}: {group: Group; striped: boolean}) {
  return (
    <Grid
      column="1 / -1"
      columns="subgrid"
      align="center"
      radius="xs"
      padding="2xs md"
      background={striped ? 'secondary' : undefined}
    >
      <Text as="div" align="left" variant="inherit">
        {t('Issue First Seen')}
      </Text>
      <Container />
      <Container />
      <DateTime date={group.firstSeen} year timeZone />
      <div />
    </Grid>
  );
}

function FlagValueActionsMenu({flagValue}: {flagValue: RawFlag}) {
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();
  const key = flagValue.flag;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <RevealOnHover.Action visible={isVisible}>
      <DropdownMenu
        size="xs"
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
    </RevealOnHover.Action>
  );
}
