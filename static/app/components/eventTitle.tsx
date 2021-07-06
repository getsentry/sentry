import styled from '@emotion/styled';

import {EventOrGroupType} from 'app/types';

type Props = {
  eventType: EventOrGroupType;
  title: string;
};

function EventTitle({eventType}: Props) {
  if (eventType === EventOrGroupType.ERROR) {
  }

  return <Wrapper>{null}</Wrapper>;
}

export default EventTitle;

const Wrapper = styled('span')``;
