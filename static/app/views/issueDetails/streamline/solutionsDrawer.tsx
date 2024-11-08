import styled from '@emotion/styled';

import bannerImage from 'sentry-images/insights/module-upsells/insights-module-upsell.svg';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import {useGroupSummary} from 'sentry/components/group/groupSummary';
import {IconFatal, IconFocus, IconLightning, IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
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
        {hasGenAIConsent && config.issueSummary.enabled && data && (
          <GroupSummaryWrapper>
            <SummaryHeader>
              <HeaderRow>
                <IconContainer>
                  <IconFocus />
                </IconContainer>
                <HeadlineContent
                  dangerouslySetInnerHTML={{
                    __html: marked(`TL;DR: ${data.headline ?? ''}`),
                  }}
                />
              </HeaderRow>
            </SummaryHeader>
            <InsightGrid>
              {data.whatsWrong && (
                <InsightCard>
                  <CardTitle>
                    <CardTitleWrapper>
                      <CardTitleIcon>
                        <IconFatal size="sm" />
                      </CardTitleIcon>
                      <CardTitleText>{t("What's wrong?")}</CardTitleText>
                    </CardTitleWrapper>
                  </CardTitle>
                  <CardContent
                    dangerouslySetInnerHTML={{
                      __html: marked(data.whatsWrong),
                    }}
                  />
                </InsightCard>
              )}
              {data.trace && (
                <InsightCard>
                  <CardTitle>
                    <CardTitleWrapper>
                      <CardTitleIcon>
                        <IconSpan size="sm" />
                      </CardTitleIcon>
                      <CardTitleText>{t('Trace')}</CardTitleText>
                    </CardTitleWrapper>
                  </CardTitle>
                  <CardContent
                    dangerouslySetInnerHTML={{
                      __html: marked(data.trace),
                    }}
                  />
                </InsightCard>
              )}
              {data.possibleCause && (
                <InsightCard>
                  <CardTitle>
                    <CardTitleWrapper>
                      <CardTitleIcon>
                        <IconLightning size="sm" />
                      </CardTitleIcon>
                      <CardTitleText>{t('Possible cause')}</CardTitleText>
                    </CardTitleWrapper>
                  </CardTitle>
                  <CardContent
                    dangerouslySetInnerHTML={{
                      __html: marked(data.possibleCause),
                    }}
                  />
                </InsightCard>
              )}
            </InsightGrid>
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

const HeaderRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const IconContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const InsightGrid = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(1)};
  margin-top: ${space(1)};
`;

const InsightCard = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
  flex: 1 1 15rem;
`;

const CardTitle = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const CardTitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const CardTitleIcon = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
`;

const CardTitleText = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const CardContent = styled('div')`
  overflow-wrap: break-word;
  word-break: break-word;
  margin-top: ${space(1)};
  p {
    margin: 0;
    white-space: pre-wrap;
  }
  code {
    word-break: break-all;
  }
`;
