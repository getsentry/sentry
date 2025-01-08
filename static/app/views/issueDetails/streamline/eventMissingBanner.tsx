import styled from '@emotion/styled';

import compassImage from 'sentry-images/spot/onboarding-compass.svg';

import {Flex} from 'sentry/components/container/flex';
import Link from 'sentry/components/links/link';
import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {RESERVED_EVENT_IDS} from 'sentry/views/issueDetails/useGroupEvent';
import {useDefaultIssueEvent} from 'sentry/views/issueDetails/utils';

export function EventMissingBanner() {
  const organization = useOrganization();
  const defaultEventId = useDefaultIssueEvent();
  const {groupId, eventId = defaultEventId} = useParams<{
    eventId: string;
    groupId: string;
  }>();
  const baseUrl = `/organizations/${organization.slug}/issues/${groupId}/events`;
  const isReservedEventId = RESERVED_EVENT_IDS.has(eventId);

  const specificEventTips = [
    t(
      'Double check the event ID. It may be incorrect, or its age exceeded the retention policy.'
    ),
    tct(
      'Switch over to a [link:recommended] event instead, it should have more useful data.',
      {
        link: (
          <Link
            to={`${baseUrl}/recommended/statsPeriod=${MAX_PICKABLE_DAYS}d`}
            aria-label={t('View recommended event')}
          />
        ),
      }
    ),
  ];
  const reservedEventTips = [
    t(
      'Change up your filters. Try more environments, a wider date range, or a different query'
    ),
    tct('If nothing stands out, try [link:clearing your filters] all together', {
      link: (
        <Link
          to={{
            pathname: `${baseUrl}/${eventId}`,
            query: {statsPeriod: `${MAX_PICKABLE_DAYS}d`},
          }}
          aria-label={t('Clear event filters')}
        />
      ),
    }),
  ];

  const tips = isReservedEventId ? reservedEventTips : specificEventTips;

  return (
    <Flex align="center" justify="center">
      <Flex align="center" gap={36}>
        <img src={compassImage} alt="Compass illustration" height={122} />
        <Flex justify="center" column gap={space(1)}>
          <MainText>
            {tct("We couldn't track down [prep] event", {
              prep: isReservedEventId ? 'an' : 'that',
            })}
            {!isReservedEventId && eventId ? (
              <EventIdText>({eventId})</EventIdText>
            ) : null}
          </MainText>
          <SubText>
            {t('If this is unexpected, here are some things to try:')}
            <ul style={{margin: 0}}>
              {tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </SubText>
        </Flex>
      </Flex>
    </Flex>
  );
}

const MainText = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const SubText = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const EventIdText = styled(SubText)`
  font-style: italic;
  color: ${p => p.theme.subText};
`;
