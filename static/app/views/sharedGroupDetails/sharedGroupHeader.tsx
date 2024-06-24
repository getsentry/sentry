import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {DateTime} from 'sentry/components/dateTime';
import EventMessage from 'sentry/components/events/eventMessage';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ShortId from 'sentry/components/shortId';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';
import getDynamicText from 'sentry/utils/getDynamicText';
import EventCreatedTooltip from 'sentry/views/issueDetails/eventCreatedTooltip';

type Props = {
  group: Group;
};

function SharedGroupHeader({group}: Props) {
  const date = group.latestEvent?.dateReceived ?? group.latestEvent?.dateCreated;
  const d = new Date(date as string);
  const event = group.latestEvent as Event;
  return (
    <Wrapper>
      <Details>
        <TitleWrap>
          <Title>{group.title}</Title>
          <ShortIdWrapper>
            <ShortId
              shortId={group.shortId}
              avatar={<ProjectBadge project={group.project} avatarSize={20} hideName />}
            />
            {group.issueCategory === IssueCategory.PERFORMANCE && (
              <FeatureBadge
                type="beta"
                title={t(
                  'Not all features have been implemented for shared Performance Issues and these issues may be missing context.'
                )}
              />
            )}
          </ShortIdWrapper>

          <TimeStamp>
            {'Last seen '}
            {(event.dateCreated ?? event.dateReceived) && (
              <EventTimeLabel>
                {getDynamicText({
                  fixed: 'Jan 1, 12:00 AM',
                  value: (
                    <Tooltip
                      isHoverable
                      showUnderline
                      title={<EventCreatedTooltip event={event} />}
                      overlayStyle={{maxWidth: 300}}
                    >
                      <DateTime date={d.toLocaleString()} />
                      {/* {d.toLocaleString('default', {month: 'long'})} */}
                    </Tooltip>
                  ),
                })}
              </EventTimeLabel>
            )}
          </TimeStamp>
        </TitleWrap>
        <EventMessage
          showUnhandled={group.isUnhandled}
          message={group.culprit}
          level={group.level}
          type={group.type}
        />
      </Details>
    </Wrapper>
  );
}

export default SharedGroupHeader;

const Wrapper = styled('div')`
  padding: ${space(3)} ${space(4)} ${space(3)} ${space(4)};
  border-bottom: 1px solid ${p => p.theme.border};
  position: relative;
`;

const Details = styled('div')`
  max-width: 960px;
  margin: 0 auto;
`;

const ShortIdWrapper = styled('div')`
  display: flex;
`;

const TitleWrap = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  margin-bottom: ${space(1)};
`;

const Title = styled('h3')`
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: ${p => p.theme.text.lineHeightHeading};
  margin-right: ${space(2)};
  margin-bottom: 0;
  ${p => p.theme.overflowEllipsis};

  @media (min-width: ${props => props.theme.breakpoints.small}) {
    font-size: ${p => p.theme.headerFontSize};
  }
`;

const TimeStamp = styled('div')`
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: ${p => p.theme.text.lineHeightHeading};
  margin-top: ${space(0)};
`;

const EventTimeLabel = styled('span')`
  color: ${p => p.theme.subText};
`;
