import styled from '@emotion/styled';

import compassImage from 'sentry-images/spot/onboarding-compass.svg';

import {Flex} from 'sentry/components/container/flex';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {RESERVED_EVENT_IDS} from 'sentry/views/issueDetails/useGroupEvent';
import {useDefaultIssueEvent} from 'sentry/views/issueDetails/utils';

export function EventMissingBanner({eventError}: {eventError?: RequestError}) {
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
          <Link to={`${baseUrl}/recommended/`} aria-label={t('View recommended event')} />
        ),
      }
    ),
  ];
  const reservedEventTips = [
    t(
      'Change up your filters. Try more environments, a wider date range, or a different query'
    ),
    tct('If nothing stands out, try [link:clearing your filters] all together', {
      link: <Link to={`${baseUrl}/${eventId}/`} aria-label={t('Clear event filters')} />,
    }),
  ];

  const tips = isReservedEventId ? reservedEventTips : specificEventTips;

  return (
    <Flex align="center" justify="center">
      <CompassContainer>
        <img src={compassImage} alt="Compass illustration" height={125} />
        <Flex justify="center" column gap={space(1)}>
          <MainText>
            {tct("We couldn't track down [prep] event", {
              prep: isReservedEventId ? 'an' : 'that',
            })}
            {!isReservedEventId && eventId ? (
              <EventIdText>({eventId})</EventIdText>
            ) : null}
          </MainText>
          <ResponseText eventError={eventError} />
          <SubText style={{marginTop: space(1)}}>
            {t('If this is unexpected, here are some things to try:')}
            <ul style={{margin: 0}}>
              {tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </SubText>
        </Flex>
      </CompassContainer>
    </Flex>
  );
}

function ResponseText({eventError}: {eventError?: RequestError}) {
  const errorStatus = eventError?.status;
  const errorDetails = eventError?.responseJSON?.detail;
  if (!errorDetails) {
    return null;
  }
  return (
    <SubText>
      {errorStatus ? <strong>{errorStatus}: </strong> : null}
      {typeof errorDetails === 'string' ? errorDetails : null}
    </SubText>
  );
}

const CompassContainer = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: ${space(4)};
`;

const MainText = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(1)};
`;

const SubText = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const EventIdText = styled(SubText)`
  font-style: italic;
  color: ${p => p.theme.subText};
`;
