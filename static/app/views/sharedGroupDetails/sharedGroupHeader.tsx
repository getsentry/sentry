import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {EventMessage} from 'sentry/components/events/eventMessage';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ShortId from 'sentry/components/shortId';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {EventCreatedTooltip} from 'sentry/views/issueDetails/eventCreatedTooltip';

type Props = {
  group: Group;
};

export function SharedGroupHeader({group}: Props) {
  const date = new Date(
    (group.latestEvent?.dateCreated ?? group.latestEvent?.dateReceived) as string
  );
  const event = group.latestEvent;

  return (
    <Wrapper>
      <Details>
        <TitleWrap>
          <Title>{group.title}</Title>
          <Flex>
            <ShortId
              shortId={group.shortId}
              avatar={<ProjectBadge project={group.project} avatarSize={20} hideName />}
            />
          </Flex>
          {event && (event.dateCreated ?? event.dateReceived) && (
            <TimeStamp data-test-id="sgh-timestamp">
              {t('Last seen ')}
              <EventTimeLabel>
                <Tooltip
                  isHoverable
                  showUnderline
                  title={<EventCreatedTooltip event={event} />}
                  overlayStyle={{maxWidth: 300}}
                >
                  <DateTime date={date} />
                </Tooltip>
              </EventTimeLabel>
            </TimeStamp>
          )}
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

const Wrapper = styled('div')`
  padding: ${p => p.theme.space['2xl']} ${p => p.theme.space['3xl']}
    ${p => p.theme.space['2xl']} ${p => p.theme.space['3xl']};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  position: relative;
`;

const Details = styled('div')`
  max-width: 960px;
  margin: 0 auto;
`;

const TitleWrap = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  margin-bottom: ${p => p.theme.space.md};
`;

const Title = styled('h3')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.xl};
  line-height: ${p => p.theme.font.lineHeight.default};
  margin-right: ${p => p.theme.space.xl};
  margin-bottom: 0;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TimeStamp = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.md};
  line-height: ${p => p.theme.font.lineHeight.default};
  margin-top: ${p => p.theme.space['2xs']};
`;

const EventTimeLabel = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  margin-left: ${p => p.theme.space['2xs']};
`;
