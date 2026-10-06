import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
// eslint-disable-next-line no-restricted-imports
import color from 'color';

import {FeatureBadge, Tag} from '@sentry/scraps/badge';
import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {EventMessage} from 'sentry/components/events/eventMessage';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {useFeedbackSDKIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import {TourElement} from 'sentry/components/tours/components';
import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {getOverride} from 'sentry/overrideRegistry';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {AI_DETECTED_ISSUE_TYPES, IssueType} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getMessage, getTitle} from 'sentry/utils/events';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {GroupActions} from 'sentry/views/issueDetails/actions/index';
import {GroupPriority} from 'sentry/views/issueDetails/groupPriority';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/header/assigneeSelector';
import {GroupStatusSubtitle} from 'sentry/views/issueDetails/header/groupStatusSubtitle';
import {useIssueIdBreadcrumbItem} from 'sentry/views/issueDetails/header/issueIdBreadcrumb';
import {
  IssueDetailsTour,
  IssueDetailsTourContext,
} from 'sentry/views/issueDetails/issueDetailsTour';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';
import {TopBar} from 'sentry/views/navigation/topBar';

interface GroupHeaderProps {
  event: Event | null;
  group: Group;
  project: Project;
}

export function GroupHeader({event, group, project}: GroupHeaderProps) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const {baseUrl} = useGroupDetailsRoute();

  const {sort: _sort, ...query} = location.query;
  const {count: eventCount, userCount} = group;
  const useGetMaxRetentionDays =
    getOverride('react-hook:use-get-max-retention-days') ?? (() => MAX_PICKABLE_DAYS);
  const maxRetentionDays = useGetMaxRetentionDays(); // oxlint-disable-line react/hooks -- Hook comes from the override registry, which is populated before React renders.
  const userCountPeriod = maxRetentionDays ? `(${maxRetentionDays}d)` : '(30d)';
  const {title: primaryTitle} = getTitle(group);
  const secondaryTitle = getMessage(group);
  const isComplete = group.status === 'resolved' || group.status === 'ignored';
  const groupReprocessingStatus = getGroupReprocessingStatus(group);
  const disableActions = [
    ReprocessingStatus.REPROCESSING,
    ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT,
  ].includes(groupReprocessingStatus);

  const hasErrorUpsampling = project.features.includes('error-upsampling');

  const isAIDetectedIssue = AI_DETECTED_ISSUE_TYPES.has(group.issueType);

  const issueTypeConfig = getConfigForIssueType(group, project);

  const issueItem = useIssueIdBreadcrumbItem({project, group});

  return (
    <Fragment>
      <Container
        as="header"
        background="primary"
        paddingTop="md"
        paddingBottom="md"
        css={cssTheme => css`
          padding-inline: var(--issue-details-inset, ${cssTheme.space['2xl']});
        `}
      >
        <Flex justify="between">
          <Flex align="center" gap="md">
            <TopBar.Slot name="breadcrumbs">
              <BreadcrumbList
                items={[
                  {
                    type: 'link',
                    label: t('Issues'),
                    to: {
                      pathname: `/organizations/${organization.slug}/issues/`,
                      query,
                    },
                  },
                ]}
              />
            </TopBar.Slot>
            <TopBar.Slot name="title">
              <BreadcrumbList.Title item={issueItem} />
            </TopBar.Slot>
            {hasErrorUpsampling && (
              <Container display={{zero: 'none', sm: 'block'}}>
                <Tooltip
                  title={t(
                    'Error counts on this page have been upsampled based on your sampling rate.'
                  )}
                >
                  <Tag variant="muted">{t('Errors Upsampled')}</Tag>
                </Tooltip>
              </Container>
            )}
          </Flex>
          <Grid flow="column" align="center" gap="xs">
            <HeaderActions group={group} />
          </Grid>
        </Flex>
        <Grid columns="minmax(150px, 1fr) auto auto" gap="0 xl" align="center">
          <Grid columns="minmax(0, max-content) min-content" align="center" gap="sm">
            <InfoText
              title={primaryTitle}
              mode="overflowOnly"
              delay={1000}
              size="xl"
              bold
            >
              {primaryTitle}
            </InfoText>
            {isAIDetectedIssue && <FeatureBadge type="new" />}
          </Grid>
          <Container justifySelf="end">
            {layoutProps => (
              <Text
                {...layoutProps}
                as="div"
                size="sm"
                variant="muted"
                bold
                density="compressed"
              >
                {issueTypeConfig.eventAndUserCounts.enabled && (
                  <StatLink
                    to={`${baseUrl}events/${location.search}`}
                    aria-label={t('View events')}
                  >
                    {t('Events (total)')}
                  </StatLink>
                )}
              </Text>
            )}
          </Container>
          <Container justifySelf="end">
            {layoutProps => (
              <Text
                {...layoutProps}
                as="div"
                size="sm"
                variant="muted"
                bold
                density="compressed"
              >
                {issueTypeConfig.eventAndUserCounts.enabled &&
                  (userCount === 0 ? (
                    t('Users %s', userCountPeriod)
                  ) : (
                    <StatLink
                      to={`${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}user/${location.search}`}
                      aria-label={t('View affected users')}
                    >
                      {t('Users %s', userCountPeriod)}
                    </StatLink>
                  ))}
              </Text>
            )}
          </Container>
          <EventMessage level={group.level} message={secondaryTitle} type={group.type} />
          {issueTypeConfig.eventAndUserCounts.enabled && (
            <Fragment>
              <Text as="div" size="xl" density="compressed" align="right">
                <Count value={eventCount} aria-label={t('Event count')} />
              </Text>
              <Text as="div" size="xl" density="compressed" align="right">
                <Count value={userCount} aria-label={t('User count')} />
              </Text>
            </Fragment>
          )}
          <Container column="1 / -1">
            <GroupStatusSubtitle group={group} project={project} />
          </Container>
        </Grid>
      </Container>
      <TourElement<IssueDetailsTour>
        tourContext={IssueDetailsTourContext}
        id={IssueDetailsTour.WORKFLOWS}
        title={t('Take action')}
        description={t(
          "Now that you've learned about this issue, it's time to assign an owner, update priority, and take additional actions."
        )}
        position="bottom-end"
      >
        {tourProps => (
          <div {...tourProps}>
            <Flex
              justify="between"
              gap="md"
              wrap="wrap"
              paddingTop="md"
              paddingBottom="md"
              borderBottom="primary"
              position="relative"
              background={isComplete ? undefined : 'primary'}
              role="banner"
              css={cssTheme => css`
                padding-inline: var(--issue-details-inset, ${cssTheme.space['2xl']});
                transition: background 0.3s ease-in-out;
                &:before {
                  z-index: -1;
                  position: absolute;
                  inset: 0;
                  content: '';
                  background: linear-gradient(
                    to right,
                    ${cssTheme.tokens.background.primary},
                    ${color(cssTheme.tokens.content.success)
                      .lighten(0.5)
                      .alpha(0.15)
                      .string()}
                  );
                }
              `}
            >
              <Container
                aria-hidden="true"
                position="absolute"
                top={0}
                right={0}
                left={`var(--issue-details-inset, ${theme.space['2xl']})`}
                borderTop="primary"
                pointerEvents="none"
              />
              <GroupActions
                group={group}
                project={project}
                disabled={disableActions}
                event={event}
              />
              <Flex justify={{zero: 'start', '4xl': 'end'}} gap="0 xl" wrap="wrap">
                <Flex align="center" gap="xs">
                  <Text variant="muted">{t('Priority')}</Text>
                  <GroupPriority group={group} />
                </Flex>
                <Flex align="center" gap="xs">
                  <Text variant="muted">{t('Assignee')}</Text>
                  <GroupHeaderAssigneeSelector
                    group={group}
                    project={project}
                    event={event}
                  />
                </Flex>
              </Flex>
            </Flex>
          </div>
        )}
      </TourElement>
    </Fragment>
  );
}

function HeaderActions({group}: {group: Group}) {
  const {feedback} = useFeedbackSDKIntegration();

  const isAIDetectedIssue = AI_DETECTED_ISSUE_TYPES.has(group.issueType);
  const hasFeedbackForm =
    group.issueType === IssueType.QUERY_INJECTION_VULNERABILITY ||
    group.issueType === IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS ||
    isAIDetectedIssue;
  const feedbackSource =
    group.issueType === IssueType.QUERY_INJECTION_VULNERABILITY
      ? 'issue_details_query_injection'
      : isAIDetectedIssue
        ? 'issue_details_ai_detected'
        : 'issue_details_n_plus_one_api_calls';
  const feedbackOptions = {
    messagePlaceholder: t('Please provide feedback on the issue Sentry detected.'),
    tags: {'feedback.source': feedbackSource},
  };
  const feedbackLabel = t('Give feedback on the issue Sentry detected');

  if (hasFeedbackForm && feedback) {
    return (
      <TopBar.Slot name="feedback">
        <FeedbackButton
          aria-label={feedbackLabel}
          feedbackOptions={feedbackOptions}
          tooltipProps={{title: feedbackLabel}}
        >
          {null}
        </FeedbackButton>
      </TopBar.Slot>
    );
  }

  return null;
}

function StatLink({children, ...props}: LinkProps) {
  return (
    <Text variant="muted" underline={props['aria-disabled'] ? false : 'dotted'}>
      {textProps => (
        <Link {...props} {...textProps}>
          {children}
        </Link>
      )}
    </Text>
  );
}
