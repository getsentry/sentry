import {useRef} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Count from 'sentry/components/count';
import DataExport, {ExportQueryType} from 'sentry/components/dataExport';
import {DeviceName} from 'sentry/components/deviceName';
import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import {TAGS_DOCS_LINK} from 'sentry/components/events/eventTags/util';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Version from 'sentry/components/version';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {percent} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {TagDetailsDrawerContent} from 'sentry/views/issueDetails/groupTags/tagDetailsDrawerContent';
import {useGroupTags} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

type GroupTagsDrawerProps = {
  groupId: string;
  projectSlug: Project['slug'];
};

export function GroupTagsDrawer({projectSlug, groupId}: GroupTagsDrawerProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {tagKey} = useParams<{tagKey: string}>();
  const drawerRef = useRef<HTMLDivElement>(null);
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === projectSlug)!;
  const {baseUrl} = useGroupDetailsRoute();

  const {
    data = [],
    isPending,
    isError,
    refetch,
  } = useGroupTags({
    groupId,
    environment: location.query.environment as string[] | string | undefined,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        message={t('There was an error loading issue tags.')}
        onRetry={refetch}
      />
    );
  }

  const alphabeticalTags = data.sort((a, b) => a.key.localeCompare(b.key));

  return (
    <EventDrawerContainer ref={drawerRef}>
      <EventDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{groupId}</ShortId>
                </CrumbContainer>
              ),
            },
            {
              label: t('All Tags'),
              to: tagKey
                ? {
                    pathname: `${baseUrl}${TabPaths[Tab.TAGS]}`,
                    query: location.query,
                  }
                : undefined,
            },
            ...(tagKey ? [{label: tagKey}] : []),
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{tagKey ? t('Tag Details') : t('Tags')}</Header>
        {tagKey && (
          <ButtonBar gap={1}>
            <LinkButton
              size="sm"
              priority="default"
              href={`/${organization.slug}/${project.slug}/issues/${groupId}/tags/${tagKey}/export/`}
            >
              {t('Export Page to CSV')}
            </LinkButton>
            <DataExport
              payload={{
                queryType: ExportQueryType.ISSUES_BY_TAG,
                queryInfo: {
                  project: project.id,
                  group: groupId,
                  key: tagKey,
                },
              }}
            />
          </ButtonBar>
        )}
      </EventNavigator>
      <EventDrawerBody>
        {tagKey ? (
          <TagDetailsDrawerContent
            project={project}
            groupId={groupId}
            drawerRef={drawerRef}
          />
        ) : (
          <Wrapper>
            <MarginlessAlert type="info">
              {tct(
                'Tags are automatically indexed for searching and breakdown charts. Learn how to [link: add custom tags to issues]',
                {
                  link: <ExternalLink href={TAGS_DOCS_LINK} />,
                }
              )}
            </MarginlessAlert>
            <Container>
              {alphabeticalTags.map((tag, tagIdx) => (
                <TagItem key={tagIdx}>
                  <StyledPanel>
                    <PanelBody withPadding>
                      <TagHeading>
                        <LinkButton
                          priority="link"
                          size="zero"
                          to={{
                            pathname: `${location.pathname}${tag.key}/`,
                            query: location.query,
                            replace: true,
                          }}
                        >
                          <span data-test-id="tag-title">{tag.key}</span>
                        </LinkButton>
                      </TagHeading>
                      <UnstyledUnorderedList>
                        {tag.topValues.map((tagValue, tagValueIdx) => (
                          <li key={tagValueIdx} data-test-id={tag.key}>
                            <TagProgressBarLink
                              // All events with the tag as the query
                              to={{
                                pathname: `${baseUrl}${TabPaths[Tab.EVENTS]}`,
                                query: {
                                  ...location.query,
                                  query:
                                    tagValue.query || `${tag.key}:"${tagValue.value}"`,
                                },
                              }}
                            >
                              <TagBarBackground
                                widthPercent={
                                  percent(tagValue.count, tag.totalValues) + '%'
                                }
                              />
                              <TagBarLabel>
                                {tag.key === 'release' ? (
                                  <Version version={tagValue.name} anchor={false} />
                                ) : (
                                  <DeviceName value={tagValue.name} />
                                )}
                              </TagBarLabel>
                              <TagBarCount>
                                <Count value={tagValue.count} />
                              </TagBarCount>
                            </TagProgressBarLink>
                          </li>
                        ))}
                      </UnstyledUnorderedList>
                    </PanelBody>
                  </StyledPanel>
                </TagItem>
              ))}
            </Container>
          </Wrapper>
        )}
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const MarginlessAlert = styled(Alert)`
  margin: 0;
`;

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  height: 100%;
`;

const TagHeading = styled('h5')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: 0;
  color: ${p => p.theme.linkColor};
`;

const UnstyledUnorderedList = styled('ul')`
  list-style: none;
  padding-left: 0;
  margin-bottom: 0;
`;

const TagItem = styled('div')`
  padding: 0;
`;

const TagBarBackground = styled('div')<{widthPercent: string}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: ${p => p.theme.tagBar};
  border-radius: ${p => p.theme.borderRadius};
  width: ${p => p.widthPercent};
`;

const TagProgressBarLink = styled(Link)`
  position: relative;
  display: flex;
  line-height: 2.2;
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(0.5)};
  padding: 0 ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;

  &:hover {
    color: ${p => p.theme.textColor};
    text-decoration: underline;
    ${TagBarBackground} {
      background: ${p => p.theme.tagBarHover};
    }
  }
`;

const TagBarLabel = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  position: relative;
  flex-grow: 1;
  ${p => p.theme.overflowEllipsis}
`;

const TagBarCount = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  position: relative;
  padding-left: ${space(2)};
  padding-right: ${space(1)};
  font-variant-numeric: tabular-nums;
`;
