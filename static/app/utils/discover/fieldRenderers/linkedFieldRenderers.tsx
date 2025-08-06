import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';
import qs from 'query-string';

import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import BadgeDisplayName from 'sentry/components/idBadge/badgeDisplayName';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Version from 'sentry/components/version';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject, Project} from 'sentry/types/project';
import type {EventData} from 'sentry/utils/discover/eventView';
import {
  emptyValue,
  nullableValue,
  type RenderFunctionBaggage,
} from 'sentry/utils/discover/fieldRenderers';
import {
  Container,
  FieldShortId,
  NumberContainer,
  OverflowFieldShortId,
  OverflowLink,
  VersionContainer,
} from 'sentry/utils/discover/styles';
import ViewReplayLink from 'sentry/utils/discover/viewReplayLink';
import {getShortEventId} from 'sentry/utils/events';
import {isUrl} from 'sentry/utils/string/isUrl';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {QuickContextHoverWrapper} from 'sentry/views/discover/table/quickContext/quickContextWrapper';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import {makeReleaseDrawerPathname} from 'sentry/views/releases/utils/pathnames';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

type LinkedFieldFormatter = {
  renderFunc: LinkedFieldRenderFunction;
};

export type LinkedFieldRenderFunction = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => LinkedFieldRenderReturnType;

type LinkedFieldRenderReturnType = {
  node: React.ReactNode;
  /**
   * Field renderers that have internal links should populate this field
   */
  target?: LocationDescriptor;
};

/**
 * Use this for fields that have internal links
 */
export const LINKED_FIELDS: Record<string, LinkedFieldFormatter> = {
  'span.description': {
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
          // TODO: fix this
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
  'issue.id': {
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
  issue: {
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
    renderFunc: (data, {organization, projects}) => {
      const projectSlug = data.project;

      if (typeof projectSlug !== 'string' && typeof projectSlug !== 'number') {
        return {node: <Container>{emptyValue}</Container>};
      }

      let project: Project | AvatarProject | undefined;
      if (typeof projectSlug === 'number') {
        project = projects?.find(p => p.id === projectSlug.toString());
      } else {
        project = projects?.find(p => p.slug === projectSlug);
      }

      const target = getProjectLink(projectSlug, organization, projects);
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
  release: {
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

const StyledLink = styled(Link)`
  max-width: 100%;
`;

const StyledProjectBadge = styled(ProjectBadge)`
  ${BadgeDisplayName} {
    max-width: 100%;
  }
`;
