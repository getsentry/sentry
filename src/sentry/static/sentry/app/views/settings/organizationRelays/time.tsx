import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';
import {defined} from 'app/utils';

type Props = {
  label: string;
  date?: string | null;
};

const Time = ({label, date}: Props) => (
  <Wrapper>
    <TimeLabel>{label}</TimeLabel>
    {!defined(date) ? t('Unknown') : <TimeSince date={date} />}
  </Wrapper>
);

export default Time;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const TimeLabel = styled('h4')`
  font-size: ${p => p.theme.fontSizeSmall} !important;
  text-transform: uppercase;
  color: ${p => p.theme.gray500};
  margin-bottom: 0 !important;
`;
