import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button';
import {DateTime} from 'sentry/components/dateTime';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {IconArrow, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {DrawerTab} from 'sentry/views/issueDetails/groupTags/groupTagsDrawer';
import {
  getFlagActionLabel,
  type RawFlag,
} from 'sentry/views/issueDetails/streamline/featureFlagUtils';
import {useOrganizationFlagLog} from 'sentry/views/issueDetails/streamline/hooks/useOrganizationFlagLog';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function FlagDetailsDrawerContent() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const {tagKey} = useParams<{tagKey: string}>();
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();

  const sortArrow = <IconArrow color="gray300" size="xs" direction="down" />;

  const flagQuery = useMemo(() => {
    return {
      flag: tagKey,
      per_page: 50,
      queryReferrer: 'featureFlagDetailsDrawer',
      statsPeriod: '90d',
      sort: '-created_at',
      cursor: location.query.flagDrawerCursor,
    };
  }, [tagKey, location.query.flagDrawerCursor]);

  const {
    data: flagLog,
    isPending,
    isError,
    getResponseHeader,
  } = useOrganizationFlagLog({
    organization,
    query: flagQuery,
  });
  const pageLinks = getResponseHeader?.('Link') ?? null;

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError message={t('There was an error loading feature flag details.')} />
    );
  }

  if (!flagLog.data.length) {
    return (
      <EmptyStateContainer>
        <StyledEmptyStateWarning withIcon={false} small>
          {t('No audit logs were found for this feature flag.')}
        </StyledEmptyStateWarning>
        <LinkButton
          size="sm"
          to={{
            pathname: `${baseUrl}${TabPaths[Tab.TAGS]}`,
            query: {...location.query, tab: DrawerTab.FEATURE_FLAGS},
          }}
        >
          {t('See all flags')}
        </LinkButton>
      </EmptyStateContainer>
    );
  }

  return (
    <Fragment>
      <Table>
        <Header>
          <ColumnTitle>{t('Provider')}</ColumnTitle>
          <ColumnTitle>{t('Flag Name')}</ColumnTitle>
          <ColumnTitle>{t('Action')}</ColumnTitle>
          <ColumnTitle>
            {sortArrow}
            {t('Date')}
          </ColumnTitle>
        </Header>
        <Body>
          {flagLog.data.map((fv, i) => (
            <FlagDetailsRow key={`${fv.id}-${i}`} flagValue={fv} />
          ))}
        </Body>
      </Table>
      <Pagination
        pageLinks={pageLinks}
        onCursor={(cursor, path, query) => {
          trackAnalytics('flags.logs-paginated', {
            direction: cursor?.endsWith(':1') ? 'prev' : 'next',
            organization,
            surface: 'flag_drawer',
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

function FlagDetailsRow({flagValue}: {flagValue: RawFlag}) {
  return (
    <Row>
      <LeftAlignedValue>{flagValue.provider}</LeftAlignedValue>
      <LeftAlignedValue>
        <code>{flagValue.flag}</code>
      </LeftAlignedValue>
      {getFlagActionLabel(flagValue.action)}
      <DateTime date={flagValue.createdAt} year timeZone />
      <FlagValueActionsMenu flagValue={flagValue} />
    </Row>
  );
}

function FlagValueActionsMenu({flagValue}: {flagValue: RawFlag}) {
  const organization = useOrganization();
  const {onClick: handleCopy} = useCopyToClipboard({
    text: flagValue.flag,
  });
  const key = flagValue.flag;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <DropdownMenu
      size="xs"
      className={isVisible ? '' : 'invisible'}
      onOpenChange={isOpen => setIsVisible(isOpen)}
      triggerProps={{
        'aria-label': t('Flag Audit Log Actions Menu'),
        icon: <IconEllipsis />,
        showChevron: false,
        size: 'xs',
      }}
      items={[
        {
          key: 'view-issues-true',
          label: t('Search issues where this flag value is TRUE'),
          to: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {query: `flags["${key}"]:"true"`},
          },
        },
        {
          key: 'view-issues-false',
          label: t('Search issues where this flag value is FALSE'),
          to: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {query: `flags["${key}"]:"false"`},
          },
        },
        {
          key: 'copy-value',
          label: t('Copy flag value to clipboard'),
          onAction: handleCopy,
        },
      ]}
    />
  );
}

const Table = styled('div')`
  display: grid;
  grid-template-columns: 0.4fr 0.7fr 0.3fr 0.5fr min-content;
  column-gap: ${space(1)};
  row-gap: ${space(0.5)};
  margin: 0 -${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    column-gap: ${space(2)};
  }
`;

const ColumnTitle = styled('div')`
  white-space: nowrap;
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Body = styled('div')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
`;

const Header = styled(Body)`
  border-bottom: 1px solid ${p => p.theme.border};
  margin: 0 ${space(1)};
`;

const Row = styled(Body)`
  &:nth-child(even) {
    background: ${p => p.theme.backgroundSecondary};
  }
  align-items: center;
  border-radius: 4px;
  padding: ${space(0.25)} ${space(1)};

  .invisible {
    visibility: hidden;
  }
  &:hover,
  &:active {
    .invisible {
      visibility: visible;
    }
  }
`;

const LeftAlignedValue = styled('div')`
  text-align: left;
`;

const EmptyStateContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  padding: ${space(3)};
`;
