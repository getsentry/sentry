import {useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import bannerImage from 'sentry-images/spot/ai-suggestion-banner.svg';

import {Button} from 'sentry/components/button';
import {
  replaceHeadersWithBold,
  SuggestedFixSnippet,
} from 'sentry/components/events/autofix/autofixRootCause';
import type {
  AutofixInsight,
  AutofixRepository,
  BreadcrumbContext,
} from 'sentry/components/events/autofix/types';
import BreadcrumbItemContent from 'sentry/components/events/breadcrumbs/breadcrumbItemContent';
import {
  BreadcrumbIcon,
  BreadcrumbLevel,
  getBreadcrumbColorConfig,
  getBreadcrumbTitle,
} from 'sentry/components/events/breadcrumbs/utils';
import StructuredEventData from 'sentry/components/structuredEventData';
import Timeline from 'sentry/components/timeline';
import {IconArrow, IconChevron, IconCode, IconFire} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import {singleLineRenderer} from 'sentry/utils/marked';
import testableTransition from 'sentry/utils/testableTransition';

interface AutofixBreadcrumbSnippetProps {
  breadcrumb: BreadcrumbContext;
}

function AutofixBreadcrumbSnippet({breadcrumb}: AutofixBreadcrumbSnippetProps) {
  const type = BreadcrumbType[breadcrumb.category.toUpperCase()];
  const level = BreadcrumbLevelType[breadcrumb.level.toUpperCase()];
  const rawCrumb = {
    message: breadcrumb.body,
    category: breadcrumb.category,
    type: type,
    level: level,
  };

  return (
    <BackgroundPanel>
      <BreadcrumbItem
        title={
          <Header>
            <div>
              <TextBreak>{getBreadcrumbTitle(rawCrumb)}</TextBreak>
            </div>
            <BreadcrumbLevel level={level}>{level}</BreadcrumbLevel>
          </Header>
        }
        colorConfig={getBreadcrumbColorConfig(type)}
        icon={<BreadcrumbIcon type={type} />}
        isActive
        showLastLine
      >
        <ContentWrapper>
          <BreadcrumbItemContent breadcrumb={rawCrumb} meta={{}} fullyExpanded />
        </ContentWrapper>
      </BreadcrumbItem>
    </BackgroundPanel>
  );
}

export function ExpandableInsightContext({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    setExpanded(oldState => !oldState);
  };

  return (
    <ExpandableContext>
      <ContextHeader onClick={toggleExpand} name={title}>
        <ContextHeaderWrapper>
          <ContextHeaderText>{title}</ContextHeaderText>
          <IconChevron size="xs" direction={expanded ? 'down' : 'right'} />
        </ContextHeaderWrapper>
      </ContextHeader>
      {expanded && <ContextBody>{children}</ContextBody>}
    </ExpandableContext>
  );
}

const animationProps: AnimationProps = {
  exit: {opacity: 0},
  initial: {opacity: 0, y: 20},
  animate: {opacity: 1, y: 0},
  transition: testableTransition({duration: 0.3}),
};

interface AutofixInsightCardProps {
  hasCardAbove: boolean;
  hasCardBelow: boolean;
  insight: AutofixInsight;
  repos: AutofixRepository[];
}

function AutofixInsightCard({
  insight,
  hasCardBelow,
  hasCardAbove,
  repos,
}: AutofixInsightCardProps) {
  return (
    <ContentWrapper>
      <AnimatePresence initial>
        <AnimationWrapper key="content" {...animationProps}>
          {hasCardAbove && (
            <IconContainer>
              <IconArrow direction={'down'} />
            </IconContainer>
          )}
          <InsightContainer>
            <MiniHeader
              dangerouslySetInnerHTML={{
                __html: singleLineRenderer(insight.insight),
              }}
            />
            <ExpandableInsightContext title={'Context'}>
              <p
                dangerouslySetInnerHTML={{
                  __html: singleLineRenderer(
                    replaceHeadersWithBold(insight.justification)
                  ),
                }}
              />
              {insight.error_message_context &&
                insight.error_message_context.length > 0 && (
                  <div>
                    {insight.error_message_context
                      .map((message, i) => {
                        return (
                          <BackgroundPanel key={i}>
                            <ErrorMessage>
                              <ErrorMessageIcon>
                                <IconFire color="red400" size="md" />
                              </ErrorMessageIcon>
                              <p
                                dangerouslySetInnerHTML={{
                                  __html: singleLineRenderer('`' + message + '`'),
                                }}
                              />
                            </ErrorMessage>
                          </BackgroundPanel>
                        );
                      })
                      .reverse()}
                  </div>
                )}
              {insight.stacktrace_context && insight.stacktrace_context.length > 0 && (
                <div>
                  {insight.stacktrace_context
                    .map((stacktrace, i) => {
                      return (
                        <div key={i}>
                          <SuggestedFixSnippet
                            snippet={{
                              snippet: stacktrace.code_snippet,
                              repo_name: stacktrace.repo_name,
                              file_path: stacktrace.file_name,
                            }}
                            linesToHighlight={[]}
                            repos={repos}
                            icon={<IconFire color="red400" />}
                          />
                          <StyledStructuredEventData
                            data={JSON.parse(stacktrace.vars_as_json)}
                            maxDefaultDepth={1}
                          />
                        </div>
                      );
                    })
                    .reverse()}
                </div>
              )}
              {insight.breadcrumb_context && insight.breadcrumb_context.length > 0 && (
                <div>
                  {insight.breadcrumb_context
                    .map((breadcrumb, i) => {
                      return <AutofixBreadcrumbSnippet key={i} breadcrumb={breadcrumb} />;
                    })
                    .reverse()}
                </div>
              )}
              {insight.codebase_context && insight.codebase_context.length > 0 && (
                <div>
                  {insight.codebase_context
                    .map((code, i) => {
                      return (
                        <SuggestedFixSnippet
                          key={i}
                          snippet={code}
                          linesToHighlight={[]}
                          repos={repos}
                          icon={<IconCode color="purple400" />}
                        />
                      );
                    })
                    .reverse()}
                </div>
              )}
            </ExpandableInsightContext>
          </InsightContainer>
          {hasCardBelow && (
            <IconContainer>
              <IconArrow direction={'down'} />
            </IconContainer>
          )}
        </AnimationWrapper>
      </AnimatePresence>
    </ContentWrapper>
  );
}

interface AutofixInsightCardsProps {
  hasStepAbove: boolean;
  hasStepBelow: boolean;
  insights: AutofixInsight[];
  repos: AutofixRepository[];
}

function AutofixInsightCards({
  insights,
  repos,
  hasStepBelow,
  hasStepAbove,
}: AutofixInsightCardsProps) {
  return (
    <InsightsContainer>
      {!hasStepAbove && (
        <div>
          <TitleText>Insights</TitleText>
          <IconContainer>
            <IconArrow direction={'down'} />
          </IconContainer>
        </div>
      )}
      {insights.length > 0 ? (
        insights.map((insight, index) =>
          !insight ? null : (
            <AutofixInsightCard
              key={index}
              insight={insight}
              hasCardBelow={index < insights.length - 1 || hasStepBelow}
              hasCardAbove={hasStepAbove && index === 0}
              repos={repos}
            />
          )
        )
      ) : !hasStepAbove && !hasStepBelow ? (
        <NoInsightsYet>
          <p>
            Autofix will share important conclusions here as it discovers them, building a
            line of reasoning up to the root cause.
          </p>
          <IllustrationContainer>
            <Illustration src={bannerImage} />
          </IllustrationContainer>
        </NoInsightsYet>
      ) : null}
    </InsightsContainer>
  );
}

const IllustrationContainer = styled('div')`
  padding-top: ${space(4)};
`;

const Illustration = styled('img')`
  height: 100%;
`;

const NoInsightsYet = styled('div')`
  display: flex;
  justify-content: center;
  flex-direction: column;
  padding-left: ${space(4)};
  padding-right: ${space(4)};
  text-align: center;
`;

const TitleText = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
  display: flex;
  justify-content: center;
`;

const InsightsContainer = styled('div')``;

const InsightContainer = styled(motion.div)`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
`;

const IconContainer = styled('div')`
  padding: ${space(1)};
  display: flex;
  justify-content: center;
`;

const BreadcrumbItem = styled(Timeline.Item)`
  border-bottom: 1px solid transparent;
  &:not(:last-child) {
    border-image: linear-gradient(
        to right,
        transparent 20px,
        ${p => p.theme.translucentInnerBorder} 20px
      )
      100% 1;
  }
`;

const ContentWrapper = styled('div')`
  padding-bottom: ${space(1)};
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
`;

const TextBreak = styled('span')`
  word-wrap: break-word;
  word-break: break-all;
`;

const BackgroundPanel = styled('div')`
  padding: ${space(1)};
  margin-bottom: ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
`;

const MiniHeader = styled('p')`
  padding-top: ${space(2)};
  padding-right: ${space(2)};
  padding-left: ${space(2)};
`;

const ExpandableContext = styled('div')`
  width: 100%;
  background: ${p => p.theme.alert.info.backgroundLight};
`;

const ContextHeader = styled(Button)`
  width: 100%;
  box-shadow: none;
  margin: 0;
  border: none;
  font-weight: normal;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 0px;
`;

const ContextHeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const ContextHeaderText = styled('p')`
  height: 0;
`;

const ContextBody = styled('div')`
  padding: ${space(2)};
`;

const ErrorMessage = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const ErrorMessageIcon = styled('div')``;

const StyledStructuredEventData = styled(StructuredEventData)`
  border-top: solid 1px ${p => p.theme.border};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
`;

const AnimationWrapper = styled(motion.div)``;

export default AutofixInsightCards;
