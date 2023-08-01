import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import AutoSelectText from 'sentry/components/autoSelectText';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {Event} from 'sentry/types/event';

const formatDateDelta = (reference: moment.Moment, observed: moment.Moment) => {
  const duration = moment.duration(Math.abs(+observed - +reference));
  const hours = Math.floor(+duration / (60 * 60 * 1000));
  const minutes = duration.minutes();
  const results: string[] = [];

  if (hours) {
    results.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }

  if (minutes) {
    results.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }

  if (results.length === 0) {
    results.push('a few seconds');
  }

  return results.join(', ');
};

type Props = {
  event: Event;
};

export default function EventCreatedTooltip({event}: Props) {
  const user = ConfigStore.get('user');
  const options = user?.options ?? {};
  const format = options.clock24Hours ? 'HH:mm:ss z' : 'LTS z';
  const dateCreated = event.dateCreated ? moment(event.dateCreated) : null;
  const dateReceived = event.dateReceived ? moment(event.dateReceived) : null;

  return (
    <DescriptionList>
      <dt>{t('Occurred')}</dt>
      <dd>
        {dateCreated ? (
          <Fragment>
            <AutoSelectText>
              {dateCreated.format('ll')} {dateCreated.format(format)}
            </AutoSelectText>
          </Fragment>
        ) : (
          <NotApplicableText>{t('n/a')}</NotApplicableText>
        )}
      </dd>
      {dateReceived && (
        <Fragment>
          <dt>{t('Received')}</dt>
          <dd>
            <AutoSelectText>
              {dateReceived.format('ll')} {dateReceived.format(format)}
            </AutoSelectText>
          </dd>
          <dt>{t('Latency')}</dt>
          <dd>
            <AutoSelectText>
              {dateCreated ? (
                formatDateDelta(dateCreated, dateReceived)
              ) : (
                <NotApplicableText>{t('n/a')}</NotApplicableText>
              )}
            </AutoSelectText>
          </dd>
        </Fragment>
      )}
    </DescriptionList>
  );
}

const DescriptionList = styled('dl')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.75)} ${space(1)};
  text-align: left;
  margin: 0;
`;

const NotApplicableText = styled('span')`
  color: ${p => p.theme.subText};
`;
