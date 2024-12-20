import styled from '@emotion/styled';

import compassImage from 'sentry-images/spot/onboarding-compass.svg';

import {Flex} from 'sentry/components/container/flex';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useParams} from 'sentry/utils/useParams';
import {KNOWN_EVENT_IDS} from 'sentry/views/issueDetails/streamline/hooks/useStreamlineGroupEvent';

export function EventMissingBanner({eventError}: {eventError?: RequestError}) {
  const params = useParams();
  const eventId = params.eventId;

  const isSpecificEvent = !KNOWN_EVENT_IDS.has(eventId);

  return (
    <Flex align="center" justify="center">
      <CompassContainer>
        <img src={compassImage} alt="Compass illustration" height={125} />
        <Flex justify="center" column gap={space(1)}>
          <MainText>
            {tct("We couldn't track down [prep] event", {
              prep: isSpecificEvent ? 'that' : 'an',
            })}
            {isSpecificEvent ? <EventIdText>({eventId})</EventIdText> : null}
          </MainText>
          <ResponseText eventError={eventError} />
          <SubText style={{marginTop: space(1)}}>
            {t('If this is unexpected, here are some things you can try:')}
            <ul style={{margin: 0}}>
              {isSpecificEvent ? (
                <li>
                  {t(
                    'The event ID might be incorrect, or exceeded your retention policy.'
                  )}
                </li>
              ) : null}
              <li>
                {t(
                  'Change up your filters. Try more environments, a wider date range, or a different query'
                )}
              </li>
              <li>{t('Other tips')}</li>
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
  if (!errorStatus && !errorDetails) {
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
