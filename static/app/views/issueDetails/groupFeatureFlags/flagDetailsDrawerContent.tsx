import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {IconArrow, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  getFlagActionLabel,
  type RawFlag,
} from 'sentry/views/issueDetails/streamline/featureFlagUtils';
import {useOrganizationFlagLog} from 'sentry/views/issueDetails/streamline/hooks/useOrganizationFlagLog';

export function FlagDetailsDrawerContent() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const {tagKey} = useParams<{tagKey: string}>();
  const sortArrow = <IconArrow color="gray300" size="xs" direction="down" />;

  const locationQuery = useLocationQuery({
    fields: {
      cursor: decodeScalar,
      end: decodeScalar,
      flag: decodeScalar,
      sort: (value: any) => decodeScalar(value, '-created_at'),
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
    },
  });

  const flagQuery = useMemo(() => {
    const filteredFields = Object.fromEntries(
      Object.entries(locationQuery).filter(([_key, val]) => val !== '')
    );
    return {
      ...filteredFields,
      flag: tagKey,
      per_page: 15,
      queryReferrer: 'featureFlagDetailsDrawer',
    };
  }, [locationQuery, tagKey]);

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
      <EmptyStateWarning withIcon={false} small>
        {t('No audit logs were found for this feature flag.')}
      </EmptyStateWarning>
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
        onCursor={(cursor, path, query) =>
          navigate({
            pathname: path,
            query: {
              ...query,
              flagDrawerCursor: cursor,
            },
          })
        }
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
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
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
