import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import bannerImage from 'sentry-images/insights/module-upsells/insights-module-upsell.svg';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
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
import Input from 'sentry/components/input';
import StructuredEventData from 'sentry/components/structuredEventData';
import Timeline from 'sentry/components/timeline';
import {
  IconArrow,
  IconChevron,
  IconCode,
  IconFire,
  IconRefresh,
  IconUser,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import {singleLineRenderer} from 'sentry/utils/marked';
import {useMutation} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';

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
  icon,
  rounded,
}: {
  children: React.ReactNode;
  title: string;
  icon?: React.ReactNode;
  rounded?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    setExpanded(oldState => !oldState);
  };

  return (
    <ExpandableContext isRounded={rounded}>
      <ContextHeader
        onClick={toggleExpand}
        name={title}
        isRounded={rounded}
        isExpanded={expanded}
      >
        <ContextHeaderWrapper>
          <ContextHeaderLeftAlign>
            {icon}
            <ContextHeaderText>{title}</ContextHeaderText>
          </ContextHeaderLeftAlign>
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
  groupId: string;
  hasCardAbove: boolean;
  hasCardBelow: boolean;
  index: number;
  insight: AutofixInsight;
  repos: AutofixRepository[];
  runId: string;
  stepIndex: number;
}

function AutofixInsightCard({
  insight,
  hasCardBelow,
  hasCardAbove,
  repos,
  index,
  stepIndex,
  groupId,
  runId,
}: AutofixInsightCardProps) {
  const isUserMessage = insight.justification === 'USER';

  return (
    <ContentWrapper>
      <AnimatePresence initial>
        <AnimationWrapper key="content" {...animationProps}>
          {hasCardAbove && (
            <ChainLink
              insightCardAboveIndex={index - 1}
              stepIndex={stepIndex}
              groupId={groupId}
              runId={runId}
            />
          )}
          {!isUserMessage && (
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
                        let vars: any = {};
                        try {
                          vars = JSON.parse(stacktrace.vars_as_json);
                        } catch {
                          vars = {vars: stacktrace.vars_as_json};
                        }
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
                            <StyledStructuredEventData data={vars} maxDefaultDepth={1} />
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
                        return (
                          <AutofixBreadcrumbSnippet key={i} breadcrumb={breadcrumb} />
                        );
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
          )}
          {isUserMessage && (
            <UserMessageContainer>
              <IconUser />
              <UserMessage
                dangerouslySetInnerHTML={{
                  __html: singleLineRenderer(insight.insight),
                }}
              />
            </UserMessageContainer>
          )}
          {hasCardBelow && (
            <ChainLink
              insightCardAboveIndex={index}
              stepIndex={stepIndex}
              groupId={groupId}
              runId={runId}
            />
          )}
        </AnimationWrapper>
      </AnimatePresence>
    </ContentWrapper>
  );
}

interface AutofixInsightCardsProps {
  groupId: string;
  hasStepAbove: boolean;
  hasStepBelow: boolean;
  insights: AutofixInsight[];
  repos: AutofixRepository[];
  runId: string;
  stepIndex: number;
}

function AutofixInsightCards({
  insights,
  repos,
  hasStepBelow,
  hasStepAbove,
  stepIndex,
  groupId,
  runId,
}: AutofixInsightCardsProps) {
  return (
    <InsightsContainer>
      {!hasStepAbove && (
        <div>
          <TitleText>Insights</TitleText>
          <ChainLink
            insightCardAboveIndex={null}
            stepIndex={stepIndex}
            groupId={groupId}
            runId={runId}
          />
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
              index={index}
              stepIndex={stepIndex}
              groupId={groupId}
              runId={runId}
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

export function useUpdateInsightCard({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi({persistInFlight: true});

  return useMutation({
    mutationFn: (params: {
      message: string;
      retain_insight_card_index: number | null;
      step_index: number;
    }) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data: {
          run_id: runId,
          payload: {
            type: 'restart_from_point_with_feedback',
            message: params.message,
            step_index: params.step_index,
            retain_insight_card_index: params.retain_insight_card_index,
          },
        },
      });
    },
    onSuccess: _ => {
      addSuccessMessage(t("Thanks, I'll rethink this..."));
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when sending Autofix your message.'));
    },
  });
}

function ChainLink({
  groupId,
  runId,
  stepIndex,
  insightCardAboveIndex,
}: {
  groupId: string;
  insightCardAboveIndex: number | null;
  runId: string;
  stepIndex: number;
}) {
  const [showOverlay, setShowOverlay] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [comment, setComment] = useState('');
  const {mutate: send} = useUpdateInsightCard({groupId, runId});

  const handleClickOutside = event => {
    if (overlayRef.current && !overlayRef.current.contains(event.target)) {
      setShowOverlay(false);
    }
  };

  useEffect(() => {
    if (showOverlay) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOverlay]);

  return (
    <ArrowContainer>
      <IconArrow direction={'down'} className="arrow-icon" />
      <RethinkButton
        icon={<IconRefresh />}
        size="zero"
        className="hover-button"
        onClick={() => setShowOverlay(true)}
      >
        Rethink from here
      </RethinkButton>

      {showOverlay && (
        <RethinkInput ref={overlayRef}>
          <form
            onSubmit={e => {
              e.preventDefault();
              setShowOverlay(false);
              setComment('');
              send({
                message: comment,
                step_index: stepIndex,
                retain_insight_card_index: insightCardAboveIndex,
              });
            }}
            className="row-form"
          >
            <Input
              type="text"
              placeholder="Say something..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              size="md"
              autoFocus
            />
            <Button
              type="submit"
              icon={<IconRefresh />}
              title="Restart analysis from this point in the chain"
              aria-label="Restart analysis from this point in the chain"
              priority="primary"
              size="md"
            />
          </form>
        </RethinkInput>
      )}
    </ArrowContainer>
  );
}

const UserMessageContainer = styled('div')`
  color: ${p => p.theme.subText};
  display: flex;
  padding: ${space(1)};
`;

const UserMessage = styled('div')`
  margin-left: ${space(2)};
  flex-shrink: 100;
`;

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

const ArrowContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  color: ${p => p.theme.subText};
  align-items: center;
  position: relative;
  z-index: 0;

  .arrow-icon {
    margin-top: ${space(1)};
    grid-column: 2 / 3;
    justify-self: center;
  }

  .hover-button {
    opacity: 0;
    grid-column: 3 / 4;
    justify-self: end;
    transition: opacity 0.1s ease-in-out;
  }

  &:hover .hover-button {
    opacity: 1;
  }
`;

const RethinkButton = styled(Button)`
  font-weight: normal;
  font-size: small;
  border: none;
  color: ${p => p.theme.subText};
  margin-top: ${space(1)};
`;

const RethinkInput = styled('div')`
  position: absolute;
  box-shadow: ${p => p.theme.dropShadowHeavy};
  border: 1px solid ${p => p.theme.border};
  width: 95%;
  background: ${p => p.theme.backgroundElevated};
  padding: ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
  margin: 0 ${space(2)} 0 ${space(2)};

  .row-form {
    display: flex;
    gap: ${space(1)};
  }
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

const ExpandableContext = styled('div')<{isRounded?: boolean}>`
  width: 100%;
  background: ${p => p.theme.alert.info.backgroundLight};
  border-radius: ${p => (p.isRounded ? p.theme.borderRadius : 0)};
`;

const ContextHeader = styled(Button)<{isExpanded?: boolean; isRounded?: boolean}>`
  width: 100%;
  box-shadow: none;
  margin: 0;
  border: none;
  font-weight: normal;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => {
    if (!p.isRounded) {
      return 0;
    }
    if (p.isExpanded) {
      return `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`;
    }
    return p.theme.borderRadius;
  }};
`;

const ContextHeaderLeftAlign = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
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
