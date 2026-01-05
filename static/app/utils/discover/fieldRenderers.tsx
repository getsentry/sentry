import {Fragment} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import partial from 'lodash/partial';
import pick from 'lodash/pick';
import * as qs from 'query-string';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {deviceNameMapper} from 'sentry/components/deviceName';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Duration from 'sentry/components/duration';
import {ContextIcon} from 'sentry/components/events/contexts/contextIcon';
import FileSize from 'sentry/components/fileSize';
import BadgeDisplayName from 'sentry/components/idBadge/badgeDisplayName';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import UserMisery from 'sentry/components/userMisery';
import Version from 'sentry/components/version';
import {IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {IssueAttachment} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject, Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import toArray from 'sentry/utils/array/toArray';
import {browserHistory} from 'sentry/utils/browserHistory';
import type {EventData, MetaType} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import type {RateUnit} from 'sentry/utils/discover/fields';
import {
  AGGREGATIONS,
  getAggregateAlias,
  getSpanOperationName,
  isEquation,
  isRelativeSpanOperationBreakdownField,
  parseFunction,
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';
import ViewReplayLink from 'sentry/utils/discover/viewReplayLink';
import {getShortEventId} from 'sentry/utils/events';
import {FieldKind} from 'sentry/utils/fields';
import {formatRate} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import {formatApdex} from 'sentry/utils/number/formatApdex';
import {formatFloat} from 'sentry/utils/number/formatFloat';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import toPercent from 'sentry/utils/number/toPercent';
import Projects from 'sentry/utils/projects';
import {decodeScalar} from 'sentry/utils/queryString';
import {isUrl} from 'sentry/utils/string/isUrl';
import {
  DashboardFilterKeys,
  type DashboardFilters,
  type GlobalFilter,
  type Widget,
} from 'sentry/views/dashboards/types';
import {QuickContextHoverWrapper} from 'sentry/views/discover/table/quickContext/quickContextWrapper';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import type {TraceItemDetailsMeta} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {PerformanceBadge} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';
import {CurrencyCell} from 'sentry/views/insights/common/components/tableCells/currencyCell';
import {PercentChangeCell} from 'sentry/views/insights/common/components/tableCells/percentChangeCell';
import {ResponseStatusCodeCell} from 'sentry/views/insights/common/components/tableCells/responseStatusCodeCell';
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {StarredSegmentCell} from 'sentry/views/insights/common/components/tableCells/starredSegmentCell';
import {TimeSpentCell} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {ModelName} from 'sentry/views/insights/pages/agents/components/modelName';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import {
  filterToLocationQuery,
  SpanOperationBreakdownFilter,
  stringToFilter,
} from 'sentry/views/performance/transactionSummary/filter';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import {ADOPTION_STAGE_LABELS} from 'sentry/views/releases/utils';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

import ArrayValue from './arrayValue';
import {
  BarContainer,
  Container,
  FieldDateTime,
  FieldShortId,
  FlexContainer,
  IconContainer,
  NumberContainer,
  OverflowFieldShortId,
  OverflowLink,
  UserIcon,
  VersionContainer,
} from './styles';
import TeamKeyTransactionField from './teamKeyTransactionField';

/**
 * Types, functions and definitions for rendering fields in discover results.
 */
export type RenderFunctionBaggage = {
  location: Location;
  organization: Organization;
  theme: Theme;
  /**
   * If true, all fields that are not needed immediately will not be rendered lazily.
   * This is useful for fields that require api calls or other side effects to render.
   *
   * eg. the code path field in logs requires a call to the stacktrace link api to render.
   */
  disableLazyLoad?: boolean;
  eventView?: EventView;
  projectSlug?: string;
  projects?: Project[];
  /**
   * The trace item meta data for the trace item, which includes information needed to render annotated tooltip (eg. scrubbing reasons)
   */
  traceItemMeta?: TraceItemDetailsMeta;

  unit?: string;
};

type RenderFunctionOptions = {
  enableOnClick?: boolean;
};

type FieldFormatterRenderFunction = (
  field: string,
  data: EventData,
  baggage?: RenderFunctionBaggage
) => React.ReactNode;

export type FieldFormatterRenderFunctionPartial = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

type FieldFormatter = {
  isSortable: boolean;
  renderFunc: FieldFormatterRenderFunction;
};

type FieldFormatters = {
  array: FieldFormatter;
  boolean: FieldFormatter;
  currency: FieldFormatter;
  date: FieldFormatter;
  duration: FieldFormatter;
  integer: FieldFormatter;
  number: FieldFormatter;
  percent_change: FieldFormatter;
  percentage: FieldFormatter;
  rate: FieldFormatter;
  size: FieldFormatter;
  string: FieldFormatter;
};

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.subText};
`;
const emptyValue = <EmptyValueContainer>{t('(no value)')}</EmptyValueContainer>;
export const emptyStringValue = (
  <EmptyValueContainer>{t('(empty string)')}</EmptyValueContainer>
);
const missingUserMisery = tct(
  'We were unable to calculate User Misery. A likely cause of this is that the user was not set. [link:Read the docs]',
  {
    link: (
      <ExternalLink href="https://docs.sentry.io/platforms/javascript/enriching-events/identify-user/" />
    ),
  }
);
const userAgentLocking = t(
  'This operating system does not provide detailed version information in the User-Agent HTTP header. The exact operating system version is unknown.'
);

export function nullableValue(value: string | null): string | React.ReactElement {
  switch (value) {
    case null:
      return emptyValue;
    case '':
      return emptyStringValue;
    default:
      return value;
  }
}

// TODO: Remove this, use `SIZE_UNIT_MULTIPLIERS` instead
export const SIZE_UNITS = {
  bit: 1 / 8,
  byte: 1,
  kibibyte: 1024,
  mebibyte: 1024 ** 2,
  gibibyte: 1024 ** 3,
  tebibyte: 1024 ** 4,
  pebibyte: 1024 ** 5,
  exbibyte: 1024 ** 6,
  kilobyte: 1000,
  megabyte: 1000 ** 2,
  gigabyte: 1000 ** 3,
  terabyte: 1000 ** 4,
  petabyte: 1000 ** 5,
  exabyte: 1000 ** 6,
};

export const ABYTE_UNITS = [
  'byte',
  'kilobyte',
  'megabyte',
  'gigabyte',
  'terabyte',
  'petabyte',
  'exabyte',
];

// TODO: Remove this, use `DURATION_UNIT_MULTIPLIERS` instead
export const DURATION_UNITS = {
  nanosecond: 1 / 1000 ** 2,
  microsecond: 1 / 1000,
  millisecond: 1,
  second: 1000,
  minute: 1000 * 60,
  hour: 1000 * 60 * 60,
  day: 1000 * 60 * 60 * 24,
  week: 1000 * 60 * 60 * 24 * 7,
};

export const PERCENTAGE_UNITS = ['ratio', 'percent'];

/**
 * A mapping of field types to their rendering function.
 * This mapping is used when a field is not defined in SPECIAL_FIELDS
 * and the field is not being coerced to a link.
 *
 * This mapping should match the output sentry.utils.snuba:get_json_type
 */
export const FIELD_FORMATTERS: FieldFormatters = {
  boolean: {
    isSortable: true,
    renderFunc: (field, data) => {
      const value = data[field] ? t('true') : t('false');
      return <Container>{value}</Container>;
    },
  },
  date: {
    isSortable: true,
    renderFunc: (field, data, baggage) => (
      <Container>
        {data[field]
          ? getDynamicText({
              value: (
                <FieldDateTime
                  date={data[field]}
                  year
                  seconds
                  timeZone
                  utc={decodeScalar(baggage?.location?.query?.utc) === 'true'}
                />
              ),
              fixed: 'timestamp',
            })
          : emptyValue}
      </Container>
    ),
  },
  duration: {
    isSortable: true,
    renderFunc: (field, data, baggage) => {
      const {unit} = baggage ?? {};
      return (
        <NumberContainer>
          {typeof data[field] === 'number' ? (
            <Duration
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              seconds={(data[field] * ((unit && DURATION_UNITS[unit]) ?? 1)) / 1000}
              fixedDigits={2}
              abbreviation
            />
          ) : (
            emptyValue
          )}
        </NumberContainer>
      );
    },
  },
  rate: {
    isSortable: true,
    renderFunc: (field, data, baggage) => {
      const {unit} = baggage ?? {};
      return (
        <NumberContainer>
          {typeof data[field] === 'number'
            ? formatRate(data[field], unit as RateUnit, {minimumValue: 0.01})
            : emptyValue}
        </NumberContainer>
      );
    },
  },
  integer: {
    isSortable: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? <Count value={data[field]} /> : emptyValue}
      </NumberContainer>
    ),
  },
  number: {
    isSortable: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? formatFloat(data[field], 4) : emptyValue}
      </NumberContainer>
    ),
  },
  percentage: {
    isSortable: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number'
          ? formatPercentage(data[field], undefined, {minimumValue: 0.0001})
          : emptyValue}
      </NumberContainer>
    ),
  },
  size: {
    isSortable: true,
    renderFunc: (field, data, baggage) => {
      const {unit} = baggage ?? {};
      return (
        <NumberContainer>
          {unit &&
          SIZE_UNITS[unit as keyof typeof SIZE_UNITS] &&
          typeof data[field] === 'number' ? (
            <FileSize
              bytes={data[field] * SIZE_UNITS[unit as keyof typeof SIZE_UNITS]}
              base={ABYTE_UNITS.includes(unit) ? 10 : 2}
            />
          ) : (
            emptyValue
          )}
        </NumberContainer>
      );
    },
  },
  string: {
    isSortable: true,
    renderFunc: (field, data) => {
      // Some fields have long arrays in them, only show the tail of the data.
      const value = Array.isArray(data[field])
        ? data[field].slice(-1)
        : defined(data[field])
          ? data[field]
          : emptyValue;

      if (isUrl(value)) {
        return (
          <Tooltip title={value} containerDisplayMode="block" showOnlyOnOverflow>
            <Container>
              <ExternalLink href={value} data-test-id="group-tag-url">
                {value}
              </ExternalLink>
            </Container>
          </Tooltip>
        );
      }

      if (value && typeof value === 'string') {
        return (
          <Tooltip title={value} containerDisplayMode="block" showOnlyOnOverflow>
            <Container>{nullableValue(value)}</Container>
          </Tooltip>
        );
      }

      return <Container>{nullableValue(value)}</Container>;
    },
  },
  array: {
    isSortable: true,
    renderFunc: (field, data) => {
      const value = toArray(data[field]);
      return <ArrayValue value={value} />;
    },
  },
  percent_change: {
    isSortable: true,
    renderFunc: (fieldName, data) => {
      return <PercentChangeCell deltaValue={data[fieldName]} />;
    },
  },
  currency: {
    isSortable: true,
    renderFunc: (field, data) => {
      if (typeof data[field] !== 'number') {
        return <Container>{emptyValue}</Container>;
      }
      return <CurrencyCell value={data[field]} />;
    },
  },
};

type SpecialFieldRenderFunc = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

type SpecialField = {
  renderFunc: SpecialFieldRenderFunc;
  sortField: string | null;
};

const DownloadCount = styled('span')`
  padding-left: ${p => p.theme.space.sm};
`;

const RightAlignedContainer = styled('span')`
  margin-left: auto;
  margin-right: 0;
  display: block;
  text-align: right;
`;

/**
 * "Special fields" either do not map 1:1 to an single column in the event database,
 * or they require custom UI formatting that can't be handled by the datatype formatters.
 */
const SPECIAL_FIELDS: Record<string, SpecialField> = {
  // This is a custom renderer for a field outside discover
  // TODO - refactor code and remove from this file or add ability to query for attachments in Discover
  'apdex()': {
    sortField: 'apdex()',
    renderFunc: data => {
      const field = 'apdex()';

      return (
        <NumberContainer>
          {typeof data[field] === 'number' ? formatApdex(data[field]) : emptyValue}
        </NumberContainer>
      );
    },
  },
  attachments: {
    sortField: null,
    renderFunc: (data, {organization, projectSlug}) => {
      const attachments: IssueAttachment[] = data.attachments;

      const items: MenuItemProps[] = attachments
        .filter(attachment => attachment.type !== 'event.minidump')
        .map(attachment => ({
          key: attachment.id,
          label: attachment.name,
          onAction: () =>
            window.open(
              `/api/0/projects/${organization.slug}/${projectSlug}/events/${attachment.event_id}/attachments/${attachment.id}/?download=1`
            ),
        }));

      return (
        <RightAlignedContainer>
          <DropdownMenu
            position="left"
            size="xs"
            triggerProps={{
              showChevron: false,
              icon: (
                <Fragment>
                  <IconDownload color="gray500" size="sm" />
                  <DownloadCount>{items.length}</DownloadCount>
                </Fragment>
              ),
            }}
            items={items}
          />
        </RightAlignedContainer>
      );
    },
  },
  minidump: {
    sortField: null,
    renderFunc: (data, {organization, projectSlug}) => {
      const attachments: Array<IssueAttachment & {url: string}> = data.attachments;

      const minidump = attachments.find(
        attachment => attachment.type === 'event.minidump'
      );

      return (
        <RightAlignedContainer>
          <Button
            size="xs"
            disabled={!minidump}
            onClick={
              minidump
                ? () => {
                    window.open(
                      `/api/0/projects/${organization.slug}/${projectSlug}/events/${minidump.event_id}/attachments/${minidump.id}/?download=1`
                    );
                  }
                : undefined
            }
          >
            <IconDownload color="gray500" size="sm" />
            <DownloadCount>{minidump ? 1 : 0}</DownloadCount>
          </Button>
        </RightAlignedContainer>
      );
    },
  },
  id: {
    sortField: 'id',
    renderFunc: data => {
      const id: string | unknown = data?.id;
      if (typeof id !== 'string') {
        return <Container>{emptyStringValue}</Container>;
      }
      return <Container>{getShortEventId(id)}</Container>;
    },
  },
  span_id: {
    sortField: 'span_id',
    renderFunc: data => {
      const id: string | unknown = data?.span_id;
      if (typeof id !== 'string') {
        return null;
      }

      return <Container>{getShortEventId(id)}</Container>;
    },
  },
  'span.description': {
    sortField: 'span.description',
    renderFunc: data => {
      const value = data[SpanFields.SPAN_DESCRIPTION];
      const op: string = data[SpanFields.SPAN_OP];
      const projectId =
        typeof data[SpanFields.PROJECT_ID] === 'number'
          ? data[SpanFields.PROJECT_ID]
          : parseInt(data[SpanFields.PROJECT_ID], 10) || -1;
      const spanGroup: string | undefined = data[SpanFields.SPAN_GROUP];

      if (op === ModuleName.DB || op === ModuleName.RESOURCE) {
        return (
          <SpanDescriptionCell
            description={value}
            moduleName={op}
            projectId={projectId}
            group={spanGroup}
          />
        );
      }

      return (
        <Tooltip
          title={value}
          containerDisplayMode="block"
          showOnlyOnOverflow
          maxWidth={400}
        >
          <Container>
            {isUrl(value) ? (
              <ExternalLink href={value}>{value}</ExternalLink>
            ) : (
              nullableValue(value)
            )}
          </Container>
        </Tooltip>
      );
    },
  },
  trace: {
    sortField: 'trace',
    renderFunc: data => {
      const id: string | unknown = data?.trace;
      if (typeof id !== 'string') {
        return emptyValue;
      }

      return <Container>{getShortEventId(id)}</Container>;
    },
  },
  'issue.id': {
    sortField: 'issue.id',
    renderFunc: (data, {organization}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/issues/${data['issue.id']}/`,
      };

      return (
        <Container>
          <OverflowLink to={target} aria-label={data['issue.id']}>
            {data['issue.id']}
          </OverflowLink>
        </Container>
      );
    },
  },
  replayId: {
    sortField: 'replayId',
    renderFunc: (data, {organization}) => {
      const replayId = data?.replayId;
      if (typeof replayId !== 'string' || !replayId) {
        return emptyValue;
      }

      const target = makeReplaysPathname({
        path: `/${replayId}/`,
        organization,
      });

      return (
        <Container>
          <ViewReplayLink replayId={replayId} to={target}>
            {getShortEventId(replayId)}
          </ViewReplayLink>
        </Container>
      );
    },
  },
  'profile.id': {
    sortField: 'profile.id',
    renderFunc: data => {
      const id: string | unknown = data?.['profile.id'];
      if (typeof id !== 'string' || id === '') {
        return emptyValue;
      }

      return <Container>{getShortEventId(id)}</Container>;
    },
  },
  issue: {
    sortField: null,
    renderFunc: (data, {organization}) => {
      const issueID = data['issue.id'];

      if (!issueID) {
        return (
          <Container>
            <FieldShortId shortId={`${data.issue}`} />
          </Container>
        );
      }

      const target = {
        pathname: `/organizations/${organization.slug}/issues/${issueID}/`,
      };

      return (
        <QuickContextHoverWrapper
          dataRow={data}
          contextType={ContextType.ISSUE}
          organization={organization}
        >
          <StyledLink to={target} aria-label={issueID}>
            <OverflowFieldShortId shortId={`${data.issue}`} />
          </StyledLink>
        </QuickContextHoverWrapper>
      );
    },
  },
  project: {
    sortField: 'project',
    renderFunc: (data, {organization}) => {
      let slugs: string[] | undefined = undefined;
      let projectIds: number[] | undefined = undefined;
      if (typeof data.project === 'number') {
        projectIds = [data.project];
      } else {
        slugs = [data.project];
      }
      return (
        <Container>
          <Projects orgId={organization.slug} slugs={slugs} projectIds={projectIds}>
            {({projects}) => {
              let project: Project | AvatarProject | undefined;
              if (typeof data.project === 'number') {
                project = projects.find(p => p.id === data.project.toString());
              } else {
                project = projects.find(p => p.slug === data.project);
              }
              return (
                <StyledProjectBadge
                  project={project ? project : {slug: data.project}}
                  avatarSize={16}
                />
              );
            }}
          </Projects>
        </Container>
      );
    },
  },
  // Two different project ID fields are being used right now. `project_id` is shared between all datasets, but `project.id` is the new one used in spans
  project_id: {
    sortField: 'project_id',
    renderFunc: (data, baggage) => {
      const projectId = data.project_id;
      return <NumberContainer>{getProjectIdLink(projectId, baggage)}</NumberContainer>;
    },
  },
  'project.id': {
    sortField: 'project.id',
    renderFunc: (data, baggage) => {
      const projectId = data['project.id'];
      return <Container>{getProjectIdLink(projectId, baggage)}</Container>;
    },
  },
  user: {
    sortField: 'user',
    renderFunc: data => {
      if (data.user?.split) {
        const [key, value] = data.user.split(':');
        const userObj = {
          id: '',
          name: '',
          email: '',
          username: '',
          ip_address: '',
        };
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        userObj[key] = value;

        const badge = <UserBadge user={userObj} hideEmail avatarSize={16} />;
        return <Container>{badge}</Container>;
      }

      return <Container>{emptyValue}</Container>;
    },
  },
  'user.display': {
    sortField: 'user.display',
    renderFunc: data => {
      if (data['user.display']) {
        const userObj = {
          id: '',
          name: data['user.display'],
          email: '',
          username: '',
          ip_address: '',
        };

        const badge = <UserBadge user={userObj} hideEmail avatarSize={16} />;
        return <Container>{badge}</Container>;
      }

      return <Container>{emptyValue}</Container>;
    },
  },
  'count_unique(user)': {
    sortField: 'count_unique(user)',
    renderFunc: data => {
      const count = data.count_unique_user ?? data['count_unique(user)'];
      if (typeof count === 'number') {
        return (
          <FlexContainer>
            <NumberContainer>
              <Count value={count} />
            </NumberContainer>
            <UserIcon size="md" />
          </FlexContainer>
        );
      }

      return <Container>{emptyValue}</Container>;
    },
  },
  device: {
    sortField: 'device',
    renderFunc: data => {
      if (typeof data.device === 'string') {
        return <Container>{deviceNameMapper(data.device) || data.device}</Container>;
      }

      return <Container>{emptyValue}</Container>;
    },
  },
  adoption_stage: {
    sortField: 'adoption_stage',
    renderFunc: data => {
      const label = ADOPTION_STAGE_LABELS[data.adoption_stage];
      return data.adoption_stage && label ? (
        <Tooltip title={label.tooltipTitle} isHoverable>
          <Tag variant={label.variant}>{label.name}</Tag>
        </Tooltip>
      ) : (
        <Container>{emptyValue}</Container>
      );
    },
  },
  release: {
    sortField: 'release',
    renderFunc: (data, {organization}) =>
      data.release ? (
        <VersionContainer>
          <QuickContextHoverWrapper
            dataRow={data}
            contextType={ContextType.RELEASE}
            organization={organization}
          >
            <Version version={data.release} truncate />
          </QuickContextHoverWrapper>
        </VersionContainer>
      ) : (
        <Container>{emptyValue}</Container>
      ),
  },
  'error.handled': {
    sortField: 'error.handled',
    renderFunc: data => {
      const values = data['error.handled'];
      // Transactions will have null, and default events have no handled attributes.
      if (values === null || values?.length === 0) {
        return <Container>{emptyValue}</Container>;
      }
      const value = Array.isArray(values) ? values : [values];
      return (
        <Container>
          {value.every(v => [1, null].includes(v)) ? 'true' : 'false'}
        </Container>
      );
    },
  },
  [SpanFields.IS_STARRED_TRANSACTION]: {
    sortField: null,
    renderFunc: data => (
      <StarredSegmentCell
        projectSlug={data.project}
        segmentName={data.transaction}
        isStarred={data.is_starred_transaction}
      />
    ),
  },
  team_key_transaction: {
    sortField: null,
    renderFunc: (data, {organization}) => (
      <TeamKeyTransactionField
        isKeyTransaction={(data.team_key_transaction ?? 0) !== 0}
        organization={organization}
        projectSlug={data.project}
        transactionName={data.transaction}
      />
    ),
  },
  'trend_percentage()': {
    sortField: 'trend_percentage()',
    renderFunc: data => (
      <NumberContainer>
        {typeof data.trend_percentage === 'number'
          ? formatPercentage(data.trend_percentage - 1)
          : emptyValue}
      </NumberContainer>
    ),
  },
  timestamp: {
    sortField: 'timestamp',
    renderFunc: data => {
      const timestamp = data.timestamp;
      if (!timestamp) {
        return <Container>{emptyStringValue}</Container>;
      }
      const date = new Date(data.timestamp);
      return (
        <Container>
          <Tooltip title={timestamp}>
            <FieldDateTime date={date} seconds year timeZone />
          </Tooltip>
        </Container>
      );
    },
  },
  'timestamp.to_hour': {
    sortField: 'timestamp.to_hour',
    renderFunc: data => (
      <Container>
        {getDynamicText({
          value: <FieldDateTime date={data['timestamp.to_hour']} year timeZone />,
          fixed: 'timestamp.to_hour',
        })}
      </Container>
    ),
  },
  'timestamp.to_day': {
    sortField: 'timestamp.to_day',
    renderFunc: data => (
      <Container>
        {getDynamicText({
          value: <FieldDateTime date={data['timestamp.to_day']} dateOnly year utc />,
          fixed: 'timestamp.to_day',
        })}
      </Container>
    ),
  },
  'span.status_code': {
    sortField: 'span.status_code',
    renderFunc: data => (
      <Container>
        {data['span.status_code'] ? (
          <ResponseStatusCodeCell code={parseInt(data['span.status_code'], 10)} />
        ) : (
          t('Unknown')
        )}
      </Container>
    ),
  },
  'performance_score(measurements.score.total)': {
    sortField: 'performance_score(measurements.score.total)',
    renderFunc: data => {
      const score = data['performance_score(measurements.score.total)'];
      if (typeof score !== 'number') {
        return <Container>{emptyValue}</Container>;
      }
      return (
        <RightAlignedContainer>
          <PerformanceBadge score={Math.round(score * 100)} />
        </RightAlignedContainer>
      );
    },
  },
  'opportunity_score(measurements.score.total)': {
    sortField: 'opportunity_score(measurements.score.total)',
    renderFunc: data => {
      const score = data['opportunity_score(measurements.score.total)'];
      if (typeof score !== 'number') {
        return <Container>{emptyValue}</Container>;
      }
      return (
        <RightAlignedContainer>{Math.round(score * 10000) / 100}</RightAlignedContainer>
      );
    },
  },
  'browser.name': {
    sortField: 'browser.name',
    renderFunc: data => {
      const browserName = data['browser.name'];
      if (typeof browserName !== 'string' || !browserName) {
        return <Container>{emptyStringValue}</Container>;
      }

      return (
        <IconContainer>
          {getContextIcon(browserName)}
          <Container>{browserName}</Container>
        </IconContainer>
      );
    },
  },
  browser: {
    sortField: 'browser',
    renderFunc: data => {
      const browser = data.browser;
      if (typeof browser !== 'string' || !browser) {
        return <Container>{emptyStringValue}</Container>;
      }

      return (
        <IconContainer>
          {getContextIcon(dropVersion(browser))}
          <Container>{browser}</Container>
        </IconContainer>
      );
    },
  },
  'os.name': {
    sortField: 'os.name',
    renderFunc: data => {
      const osName = data['os.name'];
      if (typeof osName !== 'string' || !osName) {
        return <Container>{emptyStringValue}</Container>;
      }

      return (
        <IconContainer>
          {getContextIcon(osName)}
          <Container>{osName}</Container>
        </IconContainer>
      );
    },
  },
  os: {
    sortField: 'os',
    renderFunc: data => {
      const os = data.os;
      if (typeof os !== 'string' || !os) {
        return <Container>{emptyStringValue}</Container>;
      }

      const hasUserAgentLocking = os.includes('>=');

      return (
        <IconContainer>
          {getContextIcon(dropVersion(os))}
          {hasUserAgentLocking ? (
            <StyledTooltip title={userAgentLocking} showUnderline>
              <Container>{os}</Container>
            </StyledTooltip>
          ) : (
            <Container>{os}</Container>
          )}
        </IconContainer>
      );
    },
  },
  [SpanFields.GEN_AI_REQUEST_MODEL]: {
    sortField: SpanFields.GEN_AI_REQUEST_MODEL,
    renderFunc: data => {
      const modelId = data[SpanFields.GEN_AI_REQUEST_MODEL];

      if (!modelId) {
        return <Container>{emptyValue}</Container>;
      }

      return <ModelName modelId={data[SpanFields.GEN_AI_REQUEST_MODEL]} />;
    },
  },
  [SpanFields.GEN_AI_RESPONSE_MODEL]: {
    sortField: SpanFields.GEN_AI_RESPONSE_MODEL,
    renderFunc: data => {
      const modelId = data[SpanFields.GEN_AI_RESPONSE_MODEL];

      if (!modelId) {
        return <Container>{emptyValue}</Container>;
      }

      return <ModelName modelId={data[SpanFields.GEN_AI_RESPONSE_MODEL]} />;
    },
  },
};

/**
 * Returns a logo icon component for operating system (OS) and browser related fields
 * @param value OS or browser string. E.g., 'Safari', 'Mac OS X'
 */
const getContextIcon = (value: string) => {
  const valueArray = value.split(' ');
  const formattedValue = valueArray.join('-').toLocaleLowerCase();

  return <ContextIcon name={formattedValue} size="md" />;
};

/**
 * Drops the last part of an operating system or browser string that contains version appended at the end.
 * If the value string has no spaces, the original string will be returned.
 * @param value The string that contains the version to be dropped. E.g., 'Safari 9.1.2'
 * @returns E.g., 'Safari 9.1.2' -> 'Safari', 'Linux' -> 'Linux'
 */
const dropVersion = (value: string) => {
  const valueArray = value.split(' ');
  if (valueArray.length > 1) valueArray.pop();
  return valueArray.join(' ');
};

const getProjectIdLink = (
  projectId: number | string | undefined,
  {organization}: RenderFunctionBaggage
) => {
  const parsedId = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
  if (!defined(parsedId) || isNaN(parsedId)) {
    return emptyValue;
  }

  // TODO: Component has been deprecated in favour of hook, need to refactor this
  return (
    <Projects orgId={organization.slug} slugs={[]} projectIds={[parsedId]}>
      {({projects}) => {
        const project = projects.find(p => p.id === parsedId?.toString());
        if (!project) {
          return emptyValue;
        }
        const target = makeProjectsPathname({
          path: `/${project?.slug}/?project=${parsedId}/`,
          organization,
        });

        return <Link to={target}>{parsedId}</Link>;
      }}
    </Projects>
  );
};

type SpecialFunctionFieldRenderer = (
  fieldName: string
) => (data: EventData, baggage: RenderFunctionBaggage) => React.ReactNode;

type SpecialFunctions = {
  time_spent_percentage: SpecialFunctionFieldRenderer;
  user_misery: SpecialFunctionFieldRenderer;
};

/**
 * "Special functions" are functions whose values either do not map 1:1 to a single column,
 * or they require custom UI formatting that can't be handled by the datatype formatters.
 */
const SPECIAL_FUNCTIONS: SpecialFunctions = {
  user_misery: fieldName => data => {
    const userMiseryField = fieldName;

    if (!(userMiseryField in data)) {
      return (
        <Tooltip title={missingUserMisery} showUnderline isHoverable>
          <NumberContainer>{emptyValue}</NumberContainer>
        </Tooltip>
      );
    }

    const userMisery = data[userMiseryField];
    if (userMisery === null || isNaN(userMisery)) {
      return (
        <Tooltip title={missingUserMisery} showUnderline isHoverable>
          <NumberContainer>{emptyValue}</NumberContainer>
        </Tooltip>
      );
    }

    const projectThresholdConfig = 'project_threshold_config';
    let countMiserableUserField = '';

    let miseryLimit: number | undefined = parseInt(
      userMiseryField.split('(').pop()?.slice(0, -1) || '',
      10
    );
    if (isNaN(miseryLimit)) {
      countMiserableUserField = 'count_miserable(user)';
      if (projectThresholdConfig in data) {
        miseryLimit = data[projectThresholdConfig][1];
      } else {
        miseryLimit = undefined;
      }
    } else {
      countMiserableUserField = `count_miserable(user,${miseryLimit})`;
    }

    const uniqueUsers = data['count_unique(user)'];

    let miserableUsers: number | undefined;

    if (countMiserableUserField in data) {
      const countMiserableMiseryLimit = parseInt(
        userMiseryField.split('(').pop()?.slice(0, -1) || '',
        10
      );
      miserableUsers =
        countMiserableMiseryLimit === miseryLimit ||
        (isNaN(countMiserableMiseryLimit) && projectThresholdConfig)
          ? data[countMiserableUserField]
          : undefined;
    }

    return (
      <BarContainer>
        <UserMisery
          bars={10}
          barHeight={20}
          miseryLimit={miseryLimit}
          totalUsers={uniqueUsers}
          userMisery={userMisery}
          miserableUsers={miserableUsers}
        />
      </BarContainer>
    );
  },
  time_spent_percentage: fieldName => data => {
    const parsedFunction = parseFunction(fieldName);
    let column = parsedFunction?.arguments?.[1] ?? SpanFields.SPAN_SELF_TIME;
    // TODO - remove with eap, in eap this function only has one arg
    if (parsedFunction?.arguments?.[0] === SpanFields.SPAN_DURATION) {
      column = SpanFields.SPAN_DURATION;
    }
    return (
      <TimeSpentCell
        percentage={data[fieldName]}
        total={data[`sum(${column})`]}
        op={data[`span.op`]}
      />
    );
  },
};

/**
 * Get the sort field name for a given field if it is special or fallback
 * to the generic type formatter.
 */
export function getSortField(
  field: string,
  tableMeta: MetaType | undefined
): string | null {
  if (Object.hasOwn(SPECIAL_FIELDS, field)) {
    return SPECIAL_FIELDS[field]!.sortField;
  }

  if (!tableMeta) {
    return field;
  }

  if (isEquation(field)) {
    return field;
  }

  for (const alias in AGGREGATIONS) {
    if (field.startsWith(alias)) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return AGGREGATIONS[alias].isSortable ? field : null;
    }
  }

  const fieldType = tableMeta[field];
  if (Object.hasOwn(FIELD_FORMATTERS, fieldType)) {
    return FIELD_FORMATTERS[fieldType as keyof typeof FIELD_FORMATTERS].isSortable
      ? field
      : null;
  }

  return null;
}

const isDurationValue = (data: EventData, field: string): boolean => {
  return field in data && typeof data[field] === 'number';
};

export const spanOperationRelativeBreakdownRenderer = (
  data: EventData,
  {location, organization, eventView, theme}: RenderFunctionBaggage,
  options?: RenderFunctionOptions
): React.ReactNode => {
  const {enableOnClick = true} = options ?? {};

  const sumOfSpanTime = SPAN_OP_BREAKDOWN_FIELDS.reduce(
    (prev, curr) => (isDurationValue(data, curr) ? prev + data[curr] : prev),
    0
  );
  const cumulativeSpanOpBreakdown = Math.max(sumOfSpanTime, data['transaction.duration']);

  if (
    SPAN_OP_BREAKDOWN_FIELDS.every(field => !isDurationValue(data, field)) ||
    cumulativeSpanOpBreakdown === 0
  ) {
    return FIELD_FORMATTERS.duration.renderFunc(SPAN_OP_RELATIVE_BREAKDOWN_FIELD, data);
  }

  let otherPercentage = 1;
  let orderedSpanOpsBreakdownFields: any[];
  const sortingOnField = eventView?.sorts?.[0]?.field;
  if (sortingOnField && (SPAN_OP_BREAKDOWN_FIELDS as string[]).includes(sortingOnField)) {
    orderedSpanOpsBreakdownFields = [
      sortingOnField,
      ...SPAN_OP_BREAKDOWN_FIELDS.filter(op => op !== sortingOnField),
    ];
  } else {
    orderedSpanOpsBreakdownFields = SPAN_OP_BREAKDOWN_FIELDS;
  }

  return (
    <RelativeOpsBreakdown data-test-id="relative-ops-breakdown">
      {orderedSpanOpsBreakdownFields.map(field => {
        if (!isDurationValue(data, field)) {
          return null;
        }

        const operationName = getSpanOperationName(field) ?? 'op';
        const spanOpDuration: number = data[field];
        const widthPercentage = spanOpDuration / cumulativeSpanOpBreakdown;
        otherPercentage = otherPercentage - widthPercentage;
        if (widthPercentage === 0) {
          return null;
        }
        return (
          <div key={operationName} style={{width: toPercent(widthPercentage || 0)}}>
            <Tooltip
              title={
                <div>
                  <div>{operationName}</div>
                  <div>
                    <Duration
                      seconds={spanOpDuration / 1000}
                      fixedDigits={2}
                      abbreviation
                    />
                  </div>
                </div>
              }
              containerDisplayMode="block"
            >
              <RectangleRelativeOpsBreakdown
                style={{
                  backgroundColor: pickBarColor(operationName, theme),
                  cursor: enableOnClick ? 'pointer' : 'default',
                }}
                onClick={event => {
                  if (!enableOnClick) {
                    return;
                  }
                  event.stopPropagation();
                  const filter = stringToFilter(operationName);
                  if (filter === SpanOperationBreakdownFilter.NONE) {
                    return;
                  }
                  trackAnalytics('performance_views.relative_breakdown.selection', {
                    action: filter,
                    organization,
                  });
                  browserHistory.push({
                    pathname: location.pathname,
                    query: {
                      ...location.query,
                      ...filterToLocationQuery(filter),
                    },
                  });
                }}
              />
            </Tooltip>
          </div>
        );
      })}
      <div key="other" style={{width: toPercent(otherPercentage || 0)}}>
        <Tooltip title={<div>{t('Other')}</div>} containerDisplayMode="block">
          <OtherRelativeOpsBreakdown />
        </Tooltip>
      </div>
    </RelativeOpsBreakdown>
  );
};

const RelativeOpsBreakdown = styled('div')`
  position: relative;
  display: flex;
`;

const RectangleRelativeOpsBreakdown = styled(RowRectangle)`
  position: relative;
  width: 100%;
`;

const OtherRelativeOpsBreakdown = styled(RectangleRelativeOpsBreakdown)`
  background-color: ${p => p.theme.colors.gray100};
`;

const StyledLink = styled(Link)`
  max-width: 100%;
`;

const StyledProjectBadge = styled(ProjectBadge)`
  ${BadgeDisplayName} {
    max-width: 100%;
  }
`;

const StyledTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis}
`;

export function getFieldRenderer(
  field: string,
  meta: MetaType,
  isAlias = true,
  widget: Widget | undefined = undefined,
  dashboardFilters: DashboardFilters | undefined = undefined
): FieldFormatterRenderFunctionPartial {
  const baseRenderer = getFieldRendererBase(field, meta, isAlias);
  return wrapFieldRendererInDashboardLink(baseRenderer, field, widget, dashboardFilters);
}

/**
 * Get the field renderer for the named field and metadata
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @param {boolean} isAlias convert the name with getAggregateAlias
 * @returns {Function}
 */
function getFieldRendererBase(
  field: string,
  meta: MetaType,
  isAlias = true
): FieldFormatterRenderFunctionPartial {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return SPECIAL_FIELDS[field].renderFunc;
  }

  if (isRelativeSpanOperationBreakdownField(field)) {
    return spanOperationRelativeBreakdownRenderer;
  }

  const fieldName = isAlias ? getAggregateAlias(field) : field;
  const fieldType = meta[fieldName] || meta.fields?.[fieldName];

  for (const alias in SPECIAL_FUNCTIONS) {
    if (fieldName.startsWith(alias)) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return SPECIAL_FUNCTIONS[alias](fieldName);
    }
  }

  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return partial(FIELD_FORMATTERS[fieldType].renderFunc, fieldName);
  }
  return partial(FIELD_FORMATTERS.string.renderFunc, fieldName);
}

// TODO: Need to handle cases where a field already has a link in it's renderer
function wrapFieldRendererInDashboardLink(
  renderer: FieldFormatterRenderFunctionPartial,
  field: string,
  widget: Widget | undefined = undefined,
  dashboardFilters: DashboardFilters | undefined = undefined
): FieldFormatterRenderFunctionPartial {
  return function (data, baggage) {
    const dashboardUrl = getDashboardUrl(data, field, baggage, widget, dashboardFilters);
    if (dashboardUrl) {
      return <Link to={dashboardUrl}>{renderer(data, baggage)}</Link>;
    }
    return renderer(data, baggage);
  };
}

function getDashboardUrl(
  data: EventData,
  field: string,
  baggage: RenderFunctionBaggage,
  widget: Widget | undefined = undefined,
  dashboardFilters: DashboardFilters | undefined = undefined
) {
  const {organization, location, projects} = baggage;
  if (widget?.widgetType && dashboardFilters) {
    // Table widget only has one query
    const dashboardLink = widget.queries[0]?.linkedDashboards?.find(
      linkedDashboard => linkedDashboard.field === field
    );
    if (dashboardLink && dashboardLink.dashboardId !== '-1') {
      const newTemporaryFilters: GlobalFilter[] = [
        ...(dashboardFilters[DashboardFilterKeys.GLOBAL_FILTER] ?? []),
      ].filter(
        filter =>
          Boolean(filter.value) &&
          !(filter.tag.key === field && filter.dataset === widget.widgetType)
      );

      // Format the value as a proper filter condition string
      const mutableSearch = new MutableSearch('');
      const formattedValue = mutableSearch
        .addFilterValueList(field, [data[field]])
        .toString();

      newTemporaryFilters.push({
        dataset: widget.widgetType,
        tag: {key: field, name: field, kind: FieldKind.TAG},
        value: formattedValue,
        isTemporary: true,
      });

      // Preserve project, environment, and time range query params
      const filterParams = pick(location.query, [
        'release',
        'environment',
        'project',
        'statsPeriod',
        'start',
        'end',
      ]);

      if ('project' in data) {
        const projectId = projects?.find(project => project.slug === data.project)?.id;
        if (projectId) {
          filterParams.project = projectId;
        }
      }

      const url = `/organizations/${organization.slug}/dashboard/${dashboardLink.dashboardId}/?${qs.stringify(
        {
          [DashboardFilterKeys.GLOBAL_FILTER]: newTemporaryFilters.map(filter =>
            JSON.stringify(filter)
          ),
          ...filterParams,
        }
      )}`;

      return url;
    }
  }
  return undefined;
}
