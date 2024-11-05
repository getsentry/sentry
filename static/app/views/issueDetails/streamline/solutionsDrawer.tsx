import styled from '@emotion/styled';

import bannerImage from 'sentry-images/insights/module-upsells/insights-module-upsell.svg';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import {useGroupSummary} from 'sentry/components/group/groupSummary';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import marked from 'sentry/utils/marked';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventTitle';
import Resources from 'sentry/views/issueDetails/streamline/resources';

interface SolutionsDrawerProps {
  group: Group;
  project: Project;
  event?: Event;
}

export function SolutionsDrawer({group, project, event}: SolutionsDrawerProps) {
  const {data, hasGenAIConsent} = useGroupSummary(group.id, group.issueCategory);
  const config = getConfigForIssueType(group, project);

  return (
    <SolutionsDrawerContainer>
      <SolutionsDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{group.shortId}</ShortId>
                </CrumbContainer>
              ),
            },
            {label: event ? getShortEventId(event.id) : ''},
            {label: t('Solutions & Resources')},
          ]}
        />
      </SolutionsDrawerHeader>
      <Content>
        <Header>{t('Solution Center')}</Header>
        <IllustrationContainer>
          <Illustration src={bannerImage} />
        </IllustrationContainer>
        {hasGenAIConsent && group.issueCategory === IssueCategory.ERROR && data && (
          <GroupSummaryWrapper>
            <SummaryHeader>{t('Issue Summary')}</SummaryHeader>
            <HeadlineContent>{data.headline}</HeadlineContent>
            <SummaryContent
              dangerouslySetInnerHTML={{
                __html: marked(data.summary),
              }}
            />
          </GroupSummaryWrapper>
        )}
        {config.resources && (
          <Resources
            eventPlatform={event?.platform}
            group={group}
            configResources={config.resources}
          />
        )}
      </Content>
    </SolutionsDrawerContainer>
  );
}
const SummaryHeader = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeLarge};
`;
const HeadlineContent = styled('span')`
  overflow-wrap: break-word;
  p {
    margin: 0;
  }
  code {
    word-break: break-all;
  }
  width: 100%;
`;

const SummaryContent = styled('div')`
  overflow-wrap: break-word;
  p {
    margin: 0;
  }
  code {
    word-break: break-all;
  }
`;

const GroupSummaryWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const IllustrationContainer = styled('div')`
  display: flex;
  justify-content: center;
`;

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: 24px;
`;

const Illustration = styled('img')`
  height: 100%;
`;

const SolutionsDrawerContainer = styled('div')`
  height: 100%;
  display: grid;
  grid-template-rows: auto auto 1fr;
`;

const SolutionsDrawerHeader = styled(DrawerHeader)`
  position: unset;
  max-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: none;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const Header = styled('h3')`
  display: block;
  font-size: ${p => p.theme.headerFontSize};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

const NavigationCrumbs = styled(NavigationBreadcrumbs)`
  margin: 0;
  padding: 0;
`;

const CrumbContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const ShortId = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
`;
