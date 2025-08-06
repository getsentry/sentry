import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';
import qs from 'query-string';

import {Tag} from 'sentry/components/core/badge/tag';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {deviceNameMapper} from 'sentry/components/deviceName';
import BadgeDisplayName from 'sentry/components/idBadge/badgeDisplayName';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject, Project} from 'sentry/types/project';
import type {EventData} from 'sentry/utils/discover/eventView';
import {
  dropVersion,
  emptyStringValue,
  emptyValue,
  getContextIcon,
  nullableValue,
  type RenderFunctionBaggage,
  userAgentLocking,
} from 'sentry/utils/discover/fieldRenderers';
import {
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
} from 'sentry/utils/discover/styles';
import TeamKeyTransactionField from 'sentry/utils/discover/teamKeyTransactionField';
import ViewReplayLink from 'sentry/utils/discover/viewReplayLink';
import {getShortEventId} from 'sentry/utils/events';
import getDynamicText from 'sentry/utils/getDynamicText';
import {formatApdex} from 'sentry/utils/number/formatApdex';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {isUrl} from 'sentry/utils/string/isUrl';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {QuickContextHoverWrapper} from 'sentry/views/discover/table/quickContext/quickContextWrapper';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import {PerformanceBadge} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';
import {ResponseStatusCodeCell} from 'sentry/views/insights/common/components/tableCells/responseStatusCodeCell';
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {StarredSegmentCell} from 'sentry/views/insights/common/components/tableCells/starredSegmentCell';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import {ADOPTION_STAGE_LABELS} from 'sentry/views/releases/utils';
import {makeReleaseDrawerPathname} from 'sentry/views/releases/utils/pathnames';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

type SpecialFieldFormatter = {
  renderFunc: SpecialFieldRenderFunction;
  sortField: string | null;
};

export type SpecialFieldRenderFunction = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => SpecialFieldRenderReturnType;

type SpecialFieldRenderReturnType = {
  node: React.ReactNode;
  /**
   * Field renderers that have internal links should populate this field
   */
  target?: LocationDescriptor;
};

/**
 * TODO:
 *  - Move `attachments` here
 *  - Move `minidump` here
 */
export const SPECIAL_FIELDS: Record<string, SpecialFieldFormatter> = {
  // This is a custom renderer for a field outside discover
  // TODO - refactor code and remove from this file or add ability to query for attachments in Discover
  'apdex()': {
    sortField: 'apdex()',
    renderFunc: data => {
      const field = 'apdex()';

      return {
        node: (
          <NumberContainer>
            {typeof data[field] === 'number' ? formatApdex(data[field]) : emptyValue}
          </NumberContainer>
        ),
      };
    },
  },
  id: {
    sortField: 'id',
    renderFunc: data => {
      const id: string | unknown = data?.id;
      if (typeof id !== 'string') {
        return {node: <Container>{emptyStringValue}</Container>};
      }
      return {node: <Container>{getShortEventId(id)}</Container>};
    },
  },
  span_id: {
    sortField: 'span_id',
    renderFunc: data => {
      const id: string | unknown = data?.span_id;
      if (typeof id !== 'string') {
        return {node: <Container>{emptyStringValue}</Container>};
      }

      return {node: <Container>{getShortEventId(id)}</Container>};
    },
  },
  'span.description': {
    sortField: 'span.description',
    renderFunc: (data, {location}) => {
      const value = data[SpanFields.SPAN_DESCRIPTION];
      const op: string = data[SpanFields.SPAN_OP];
      const projectId =
        typeof data[SpanFields.PROJECT_ID] === 'number'
          ? data[SpanFields.PROJECT_ID]
          : parseInt(data[SpanFields.PROJECT_ID], 10) || -1;
      const spanGroup: string | undefined = data[SpanFields.SPAN_GROUP];

      if (op === ModuleName.DB || op === ModuleName.RESOURCE) {
        let target = undefined;

        if (spanGroup) {
          // eslint-disable-next-line react-hooks/rules-of-hooks
          const moduleURL = useModuleURL(op);

          const queryString = {
            ...location.query,
            project: projectId,
            ...(op ? {[SpanFields.SPAN_OP]: op} : {}),
            extraLinkQueryParams: {},
          };

          target = normalizeUrl(
            `${moduleURL}/spans/span/${spanGroup}/?${qs.stringify(queryString)}`
          );
        }

        return {
          node: (
            <SpanDescriptionCell
              description={value}
              moduleName={op}
              projectId={projectId}
              group={spanGroup}
            />
          ),
          target,
        };
      }

      return {
        node: (
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
        ),
      };
    },
  },
  trace: {
    sortField: 'trace',
    renderFunc: data => {
      const id: string | unknown = data?.trace;
      if (typeof id !== 'string') {
        return {node: <Container>{emptyValue}</Container>};
      }

      return {node: <Container>{getShortEventId(id)}</Container>};
    },
  },
  'issue.id': {
    sortField: 'issue.id',
    renderFunc: (data, {organization}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/issues/${data['issue.id']}/`,
      };

      return {
        node: (
          <Container>
            <OverflowLink to={target} aria-label={data['issue.id']}>
              {data['issue.id']}
            </OverflowLink>
          </Container>
        ),
        target,
      };
    },
  },
  replayId: {
    sortField: 'replayId',
    renderFunc: (data, {organization}) => {
      const replayId = data?.replayId;
      if (typeof replayId !== 'string' || !replayId) {
        return {node: <Container>{emptyValue}</Container>};
      }

      const target = makeReplaysPathname({
        path: `/${replayId}/`,
        organization,
      });

      return {
        node: (
          <Container>
            <ViewReplayLink replayId={replayId} to={target}>
              {getShortEventId(replayId)}
            </ViewReplayLink>
          </Container>
        ),
        target,
      };
    },
  },
  'profile.id': {
    sortField: 'profile.id',
    renderFunc: data => {
      const id: string | unknown = data?.['profile.id'];
      if (typeof id !== 'string' || id === '') {
        return {node: <Container>{emptyValue}</Container>};
      }

      return {node: <Container>{getShortEventId(id)}</Container>};
    },
  },
  issue: {
    sortField: null,
    renderFunc: (data, {organization}) => {
      const issueID = data['issue.id'];

      if (!issueID) {
        return {
          node: (
            <Container>
              <FieldShortId shortId={`${data.issue}`} />
            </Container>
          ),
        };
      }

      const target = {
        pathname: `/organizations/${organization.slug}/issues/${issueID}/`,
      };

      return {
        node: (
          <Container>
            <QuickContextHoverWrapper
              dataRow={data}
              contextType={ContextType.ISSUE}
              organization={organization}
            >
              <StyledLink to={target} aria-label={issueID}>
                <OverflowFieldShortId shortId={`${data.issue}`} />
              </StyledLink>
            </QuickContextHoverWrapper>
          </Container>
        ),
        target,
      };
    },
  },
  project: {
    sortField: 'project',
    renderFunc: (data, {organization, projects}) => {
      const project = data.project;

      if (typeof project !== 'string' || typeof project !== 'number') {
        return {node: <Container>{emptyValue}</Container>};
      }

      const target = getProjectLink(project, organization, projects);
      return {
        node: (
          <Container>
            <StyledProjectBadge
              project={project ? project : {slug: data.project}}
              avatarSize={16}
            />
          </Container>
        ),
        target,
      };
    },
  },
  // Two different project ID fields are being used right now. `project_id` is shared between all datasets, but `project.id` is the new one used in spans
  project_id: {
    sortField: 'project_id',
    renderFunc: (data, {organization, projects}) => {
      const projectId = data.project_id;

      if (typeof projectId !== 'number') {
        return {node: <NumberContainer>{emptyValue}</NumberContainer>};
      }

      const target = getProjectLink(projectId, organization, projects);
      if (!target) return {node: <NumberContainer>{projectId}</NumberContainer>};

      return {
        node: (
          <NumberContainer>
            <Link to={target}>{projectId}</Link>
          </NumberContainer>
        ),
        target,
      };
    },
  },
  'project.id': {
    sortField: 'project.id',
    renderFunc: (data, {organization, projects}) => {
      const projectId = data['project.id'];
      if (typeof projectId !== 'number') {
        return {node: <NumberContainer>{emptyValue}</NumberContainer>};
      }

      const target = getProjectLink(projectId, organization, projects);
      if (!target) return {node: <NumberContainer>{projectId}</NumberContainer>};

      return {
        node: (
          <NumberContainer>
            <Link to={target}>{projectId}</Link>
          </NumberContainer>
        ),
        target,
      };
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
        return {node: <Container>{badge}</Container>};
      }

      return {node: <Container>{emptyValue}</Container>};
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
        return {node: <Container>{badge}</Container>};
      }

      return {node: <Container>{emptyValue}</Container>};
    },
  },
  'count_unique(user)': {
    sortField: 'count_unique(user)',
    renderFunc: data => {
      const count = data.count_unique_user ?? data['count_unique(user)'];
      if (typeof count === 'number') {
        return {
          node: (
            <FlexContainer>
              <NumberContainer>
                <Count value={count} />
              </NumberContainer>
              <UserIcon size="md" />
            </FlexContainer>
          ),
        };
      }

      return {node: <NumberContainer>{emptyValue}</NumberContainer>};
    },
  },
  device: {
    sortField: 'device',
    renderFunc: data => {
      if (typeof data.device === 'string') {
        return {
          node: <Container>{deviceNameMapper(data.device) || data.device}</Container>,
        };
      }

      return {node: <Container>{emptyValue}</Container>};
    },
  },
  adoption_stage: {
    sortField: 'adoption_stage',
    renderFunc: data => {
      const label = ADOPTION_STAGE_LABELS[data.adoption_stage];
      return data.adoption_stage && label
        ? {
            node: (
              <Tooltip title={label.tooltipTitle} isHoverable>
                <Tag type={label.type}>{label.name}</Tag>
              </Tooltip>
            ),
          }
        : {node: <Container>{emptyValue}</Container>};
    },
  },
  release: {
    sortField: 'release',
    renderFunc: (data, {organization, location}) => {
      const release = data.release;

      if (!release) {
        return {node: <Container>{emptyValue}</Container>};
      }

      const target = makeReleaseDrawerPathname({
        location,
        release,
        source: 'release-version-link',
      });

      return {
        node: (
          <VersionContainer>
            <QuickContextHoverWrapper
              dataRow={data}
              contextType={ContextType.RELEASE}
              organization={organization}
            >
              <Version version={data.release} truncate />
            </QuickContextHoverWrapper>
          </VersionContainer>
        ),
        target,
      };
    },
  },
  'error.handled': {
    sortField: 'error.handled',
    renderFunc: data => {
      const values = data['error.handled'];
      // Transactions will have null, and default events have no handled attributes.
      if (values === null || values?.length === 0) {
        return {node: <Container>{emptyValue}</Container>};
      }
      const value = Array.isArray(values) ? values : [values];
      return {
        node: (
          <Container>
            {value.every(v => [1, null].includes(v)) ? 'true' : 'false'}
          </Container>
        ),
      };
    },
  },
  [SpanFields.IS_STARRED_TRANSACTION]: {
    sortField: null,
    renderFunc: data => ({
      node: (
        <StarredSegmentCell
          projectSlug={data.project}
          segmentName={data.transaction}
          isStarred={data.is_starred_transaction}
        />
      ),
    }),
  },
  team_key_transaction: {
    sortField: null,
    renderFunc: (data, {organization}) => ({
      node: (
        <TeamKeyTransactionField
          isKeyTransaction={(data.team_key_transaction ?? 0) !== 0}
          organization={organization}
          projectSlug={data.project}
          transactionName={data.transaction}
        />
      ),
    }),
  },
  'trend_percentage()': {
    sortField: 'trend_percentage()',
    renderFunc: data => ({
      node: (
        <NumberContainer>
          {typeof data.trend_percentage === 'number'
            ? formatPercentage(data.trend_percentage - 1)
            : emptyValue}
        </NumberContainer>
      ),
    }),
  },
  timestamp: {
    sortField: 'timestamp',
    renderFunc: data => {
      const timestamp = data.timestamp;
      if (!timestamp) {
        return {node: <Container>{emptyStringValue}</Container>};
      }
      const date = new Date(data.timestamp);
      return {
        node: (
          <Container>
            <Tooltip title={timestamp}>
              <FieldDateTime date={date} seconds year timeZone />
            </Tooltip>
          </Container>
        ),
      };
    },
  },
  'timestamp.to_hour': {
    sortField: 'timestamp.to_hour',
    renderFunc: data => ({
      node: (
        <Container>
          {getDynamicText({
            value: <FieldDateTime date={data['timestamp.to_hour']} year timeZone />,
            fixed: 'timestamp.to_hour',
          })}
        </Container>
      ),
    }),
  },
  'timestamp.to_day': {
    sortField: 'timestamp.to_day',
    renderFunc: data => ({
      node: (
        <Container>
          {getDynamicText({
            value: <FieldDateTime date={data['timestamp.to_day']} dateOnly year utc />,
            fixed: 'timestamp.to_day',
          })}
        </Container>
      ),
    }),
  },
  'span.status_code': {
    sortField: 'span.status_code',
    renderFunc: data => ({
      node: (
        <Container>
          {data['span.status_code'] ? (
            <ResponseStatusCodeCell code={parseInt(data['span.status_code'], 10)} />
          ) : (
            t('Unknown')
          )}
        </Container>
      ),
    }),
  },
  'performance_score(measurements.score.total)': {
    sortField: 'performance_score(measurements.score.total)',
    renderFunc: data => {
      const score = data['performance_score(measurements.score.total)'];
      if (typeof score !== 'number') {
        return {node: <Container>{emptyValue}</Container>};
      }
      return {
        node: (
          <RightAlignedContainer>
            <PerformanceBadge score={Math.round(score * 100)} />
          </RightAlignedContainer>
        ),
      };
    },
  },
  'browser.name': {
    sortField: 'browser.name',
    renderFunc: data => {
      const browserName = data['browser.name'];
      if (typeof browserName !== 'string' || !browserName) {
        return {node: <Container>{emptyStringValue}</Container>};
      }

      return {
        node: (
          <IconContainer>
            {getContextIcon(browserName)}
            <Container>{browserName}</Container>
          </IconContainer>
        ),
      };
    },
  },
  browser: {
    sortField: 'browser',
    renderFunc: data => {
      const browser = data.browser;
      if (typeof browser !== 'string' || !browser) {
        return {node: <Container>{emptyStringValue}</Container>};
      }

      return {
        node: (
          <IconContainer>
            {getContextIcon(dropVersion(browser))}
            <Container>{browser}</Container>
          </IconContainer>
        ),
      };
    },
  },
  'os.name': {
    sortField: 'os.name',
    renderFunc: data => {
      const osName = data['os.name'];
      if (typeof osName !== 'string' || !osName) {
        return {node: <Container>{emptyStringValue}</Container>};
      }

      return {
        node: (
          <IconContainer>
            {getContextIcon(osName)}
            <Container>{osName}</Container>
          </IconContainer>
        ),
      };
    },
  },
  os: {
    sortField: 'os',
    renderFunc: data => {
      const os = data.os;
      if (typeof os !== 'string' || !os) {
        return {node: <Container>{emptyStringValue}</Container>};
      }

      const hasUserAgentLocking = os.includes('>=');

      return {
        node: (
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
        ),
      };
    },
  },
};

const getProjectLink = (
  projectId: number | string,
  organization: Organization,
  projects?: Project[]
): string | undefined => {
  let project: Project | AvatarProject | undefined;
  if (typeof projectId === 'number') {
    project = projects?.find(p => p.id === projectId.toString());
  } else {
    project = projects?.find(p => p.slug === projectId);
  }

  if (!project) return undefined;

  const target =
    makeProjectsPathname({
      path: `/${project.slug}/`,
      organization,
    }) + (project.id ? `?project=${project.id}` : '');

  return target;
};

const RightAlignedContainer = styled('span')`
  margin-left: auto;
  margin-right: 0;
`;

const StyledTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis}
`;

const StyledLink = styled(Link)`
  max-width: 100%;
`;

const StyledProjectBadge = styled(ProjectBadge)`
  ${BadgeDisplayName} {
    max-width: 100%;
  }
`;
