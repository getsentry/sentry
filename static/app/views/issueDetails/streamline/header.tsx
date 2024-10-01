import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import Count from 'sentry/components/count';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import Link from 'sentry/components/links/link';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {Divider} from 'sentry/views/issueDetails/divider';
import {useIssueDetailsHeader} from 'sentry/views/issueDetails/useIssueDetailsHeader';
import type {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

interface GroupRelease {
  firstRelease: Release;
  lastRelease: Release;
}

interface GroupHeaderProps {
  baseUrl: string;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  project: Project;
  event?: Event;
}

export default function StreamlinedGroupHeader({
  group,
  project,
  baseUrl,
  groupReprocessingStatus,
}: GroupHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {sort: _sort, ...query} = location.query;

  const {data: groupReleaseData} = useApiQuery<GroupRelease>(
    [`/organizations/${organization.slug}/issues/${group.id}/first-last-release/`],
    {
      staleTime: 30000,
      gcTime: 30000,
    }
  );

  const {count: eventCount, userCount} = group;
  const {firstRelease, lastRelease} = groupReleaseData || {};

  const {message, eventRoute, disableActions, shortIdBreadcrumb} = useIssueDetailsHeader({
    group,
    groupReprocessingStatus,
    baseUrl,
    project,
  });

  return (
    <Header>
      <StyledBreadcrumbs
        crumbs={[
          {
            label: 'Issues',
            to: {
              pathname: `/organizations/${organization.slug}/issues/`,
              query: query,
            },
          },
          {label: shortIdBreadcrumb},
        ]}
      />
      <HeadingGrid>
        <Heading>
          <TitleHeading>
            <TitleWrapper>
              <StyledEventOrGroupTitle data={group} />
            </TitleWrapper>
          </TitleHeading>
          <MessageWrapper>
            <EventMessage
              message={message}
              type={group.type}
              level={group.level}
              showUnhandled={group.isUnhandled}
            />
            {firstRelease && lastRelease && (
              <Fragment>
                <Divider />
                <ReleaseWrapper>
                  {firstRelease.id === lastRelease.id ? t('Release') : t('Releases')}
                  <VersionHoverCard
                    organization={organization}
                    projectSlug={project.slug}
                    releaseVersion={firstRelease.version}
                  >
                    <Version
                      version={firstRelease.version}
                      projectId={project.id}
                      truncate
                    />
                  </VersionHoverCard>
                  {firstRelease.id === lastRelease.id ? null : (
                    <Fragment>
                      -
                      <VersionHoverCard
                        organization={organization}
                        projectSlug={project.slug}
                        releaseVersion={lastRelease.version}
                      >
                        <Version
                          version={lastRelease.version}
                          projectId={project.id}
                          truncate
                        />
                      </VersionHoverCard>
                    </Fragment>
                  )}
                </ReleaseWrapper>
              </Fragment>
            )}
          </MessageWrapper>
        </Heading>
        <AllStats>
          <Stat>
            <Label data-test-id="all-event-count">{t('All Events')}</Label>
            <Link disabled={disableActions} to={eventRoute}>
              <StatCount value={eventCount} />
            </Link>
          </Stat>
          <Stat>
            <Label>{t('All Users')}</Label>
            <Link disabled={disableActions} to={`${baseUrl}tags/user/${location.search}`}>
              <StatCount value={userCount} />
            </Link>
          </Stat>
        </AllStats>
      </HeadingGrid>
    </Header>
  );
}

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)`
  font-size: inherit;
`;

const HeadingGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: ${space(2)};
  align-items: center;
  margin-bottom: ${space(3)};
`;

const Heading = styled('div')``;

const AllStats = styled('div')`
  display: flex;
  gap: ${space(4)};
`;

const Stat = styled('div')`
  display: inline-block;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Label = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};
`;

const StatCount = styled(Count)`
  font-size: ${p => p.theme.headerFontSize};
  display: block;
`;

const TitleWrapper = styled('h3')`
  font-size: ${p => p.theme.headerFontSize};
  margin: 0 0 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  color: ${p => p.theme.headingColor};

  & em {
    font-weight: ${p => p.theme.fontWeightNormal};
    color: ${p => p.theme.textColor};
    font-size: 90%;
  }
`;

const TitleHeading = styled('div')`
  display: flex;
  line-height: 2;
  gap: ${space(1)};
  padding-top: ${space(1)};
`;

const MessageWrapper = styled('div')`
  display: flex;
  color: ${p => p.theme.gray300};
  gap: ${space(1)};
`;

const ReleaseWrapper = styled('div')`
  display: flex;
  align-items: center;
  max-width: 40%;
  gap: ${space(0.25)};
  a {
    color: ${p => p.theme.gray300};
    text-decoration: underline;
    text-decoration-style: dotted;
  }
`;

const Header = styled('div')`
  background-color: ${p => p.theme.background};
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid ${p => p.theme.translucentBorder};

  > * {
    margin-right: 24px;
    margin-left: 24px;
  }
`;

const StyledBreadcrumbs = styled(Breadcrumbs)`
  margin-top: ${space(2)};
`;
