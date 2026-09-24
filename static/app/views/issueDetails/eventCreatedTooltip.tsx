import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {DescriptionList} from '@sentry/scraps/descriptionList';
import {Tooltip} from '@sentry/scraps/tooltip';

import {AutoSelectText} from 'sentry/components/autoSelectText';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {useUser} from 'sentry/utils/useUser';

const formatDateDelta = (reference: moment.Moment, observed: moment.Moment) => {
  const duration = moment.duration(Math.abs(+observed - +reference));
  const hours = Math.floor(+duration / (60 * 60 * 1000));
  const minutes = duration.minutes();
  const results: string[] = [];

  if (hours) {
    results.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  }

  if (minutes) {
    results.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  }

  if (results.length === 0) {
    results.push('a few seconds');
  }

  return results.join(', ');
};

type Props = {
  event: Event;
};

export function EventCreatedTooltip({event}: Props) {
  const user = useUser();
  const options = user?.options ?? {};
  const format = options.clock24Hours ? 'HH:mm:ss z' : 'LTS z';
  const dateCreated = event.dateCreated ? moment(event.dateCreated) : null;
  const dateReceived = event.dateReceived ? moment(event.dateReceived) : null;

  return (
    <Tooltip.Grid dl terms="strong">
      <DescriptionList.Term>{t('Occurred')}</DescriptionList.Term>
      <DescriptionList.Details>
        {dateCreated ? (
          <AutoSelectText>
            {dateCreated.format('ll')} {dateCreated.format(format)}
          </AutoSelectText>
        ) : (
          <NotApplicableText>{t('n/a')}</NotApplicableText>
        )}
      </DescriptionList.Details>
      {dateReceived && (
        <Fragment>
          <DescriptionList.Term>{t('Received')}</DescriptionList.Term>
          <DescriptionList.Details>
            <AutoSelectText>
              {dateReceived.format('ll')} {dateReceived.format(format)}
            </AutoSelectText>
          </DescriptionList.Details>
          <DescriptionList.Term>{t('Latency')}</DescriptionList.Term>
          <DescriptionList.Details>
            <AutoSelectText>
              {dateCreated ? (
                formatDateDelta(dateCreated, dateReceived)
              ) : (
                <NotApplicableText>{t('n/a')}</NotApplicableText>
              )}
            </AutoSelectText>
          </DescriptionList.Details>
        </Fragment>
      )}
    </Tooltip.Grid>
  );
}

const NotApplicableText = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;
