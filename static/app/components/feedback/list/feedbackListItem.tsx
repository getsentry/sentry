import {CSSProperties, forwardRef} from 'react';
import {browserHistory} from 'react-router';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Checkbox from 'sentry/components/checkbox';
import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import IssueTrackingSignals from 'sentry/components/feedback/list/issueTrackingSignals';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {Flex} from 'sentry/components/profiling/flex';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCircleFill, IconFatal, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {FeedbackIssue} from 'sentry/utils/feedback/types';
import {decodeScalar} from 'sentry/utils/queryString';
import useReplayCountForFeedbacks from 'sentry/utils/replayCount/useReplayCountForFeedbacks';
import {darkTheme, lightTheme} from 'sentry/utils/theme';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  feedbackItem: FeedbackIssue;
  isSelected: 'all-selected' | boolean;
  onSelect: (isSelected: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

function useIsSelectedFeedback({feedbackItem}: {feedbackItem: FeedbackIssue}) {
  const {feedbackSlug} = useLocationQuery({
    fields: {feedbackSlug: decodeScalar},
  });
  const [, feedbackId] = feedbackSlug.split(':') ?? [];
  return feedbackId === feedbackItem.id;
}

const FeedbackListItem = forwardRef<HTMLDivElement, Props>(
  ({className, feedbackItem, isSelected, onSelect, style}: Props, ref) => {
    const config = useLegacyStore(ConfigStore);
    const organization = useOrganization();
    const isOpen = useIsSelectedFeedback({feedbackItem});
    const {feedbackHasReplay} = useReplayCountForFeedbacks();
    const hasReplayId = feedbackHasReplay(feedbackItem.id);

    const isCrashReport = feedbackItem.metadata.source === 'crash_report_embed_form';
    const theme = isOpen || config.theme === 'dark' ? darkTheme : lightTheme;

    return (
      <CardSpacing className={className} style={style} ref={ref}>
        <ThemeProvider theme={theme}>
          <LinkedFeedbackCard
            data-selected={isOpen}
            to={() => {
              const location = browserHistory.getCurrentLocation();
              return {
                pathname: normalizeUrl(`/organizations/${organization.slug}/feedback/`),
                query: {
                  ...location.query,
                  referrer: 'feedback_list_page',
                  feedbackSlug: `${feedbackItem.project.slug}:${feedbackItem.id}`,
                },
              };
            }}
            onClick={() => {
              trackAnalytics('feedback.list-item-selected', {organization});
            }}
          >
            <InteractionStateLayer />

            <Row style={{gridArea: 'checkbox'}}>
              <Checkbox
                style={{gridArea: 'checkbox'}}
                disabled={isSelected === 'all-selected'}
                checked={isSelected !== false}
                onChange={e => onSelect(e.target.checked)}
                onClick={e => e.stopPropagation()}
                invertColors={isOpen}
              />
            </Row>

            <TextOverflow style={{gridArea: 'user'}}>
              <FeedbackItemUsername feedbackIssue={feedbackItem} detailDisplay={false} />
            </TextOverflow>

            <TimeSince date={feedbackItem.firstSeen} style={{gridArea: 'time'}} />

            {feedbackItem.hasSeen ? null : (
              <Row style={{gridArea: 'unread'}}>
                <IconCircleFill size="xs" color={isOpen ? 'white' : 'purple400'} />
              </Row>
            )}

            <Row align="flex-start" justify="flex-start" style={{gridArea: 'message'}}>
              <TextOverflow>{feedbackItem.metadata.message}</TextOverflow>
            </Row>

            <BottomGrid style={{gridArea: 'bottom'}}>
              <Row justify="flex-start" gap={space(0.75)}>
                <StyledProjectAvatar
                  project={feedbackItem.project}
                  size={12}
                  title={feedbackItem.project.slug}
                />
                <TextOverflow>{feedbackItem.shortId}</TextOverflow>
              </Row>

              <Row justify="flex-end" gap={space(1)}>
                <IssueTrackingSignals group={feedbackItem as unknown as Group} />

                {isCrashReport && (
                  <Tooltip title={t('Linked Error')} containerDisplayMode="flex">
                    <IconFatal color="red400" size="xs" />
                  </Tooltip>
                )}

                {hasReplayId && (
                  <Tooltip title={t('Linked Replay')} containerDisplayMode="flex">
                    {<IconPlay size="xs" />}
                  </Tooltip>
                )}

                {feedbackItem.assignedTo && (
                  <ActorAvatar
                    actor={feedbackItem.assignedTo}
                    size={16}
                    tooltipOptions={{containerDisplayMode: 'flex'}}
                  />
                )}
              </Row>
            </BottomGrid>
          </LinkedFeedbackCard>
        </ThemeProvider>
      </CardSpacing>
    );
  }
);

const CardSpacing = styled('div')`
  padding: ${space(0.25)} ${space(0.5)};
`;

const LinkedFeedbackCard = styled(Link)`
  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)} ${space(3)} ${space(1)} ${space(1.5)};

  color: ${p => p.theme.textColor};
  &:hover {
    color: ${p => p.theme.textColor};
  }
  &[data-selected='true'] {
    background: ${p => p.theme.purple300};
    color: white;
  }

  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-template-rows: max-content 1fr max-content;
  grid-template-areas:
    'checkbox user time'
    'unread message message'
    '. bottom bottom';
  gap: ${space(1)};
  place-items: stretch;
  align-items: center;
`;

const Row = styled(Flex)`
  place-items: center;
  overflow: hidden;
`;

const BottomGrid = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(1)};

  overflow: hidden;
`;

const StyledProjectAvatar = styled(ProjectAvatar)`
  && img {
    box-shadow: none;
  }
`;

export default FeedbackListItem;
