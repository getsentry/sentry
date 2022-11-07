import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import {Wrapper} from 'sentry/components/clippedBox';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {Event} from 'sentry/types/event';

import {RichHttpContentClippedBoxKeyValueList} from '../interfaces/request/richHttpContentClippedBoxKeyValueList';

type Props = {
  alias: string;
  data: Record<string, React.ReactNode | undefined>;
  event: Event;
};

function getKnownData(data: Props['data']) {
  return Object.entries(data)
    .filter(([k]) => k !== 'type' && k !== 'title')
    .map(([key, value]) => {
      if (key === 'headers') {
        return {
          key,
          subject: startCase(key),
          value: (
            <StyledWrapper>
              <RichHttpContentClippedBoxKeyValueList data={value} />
            </StyledWrapper>
          ),
        };
      }
      return {
        key,
        subject: startCase(key),
        value,
      };
    });
}

const DefaultContextType = ({data}: Props) => (
  <StyledContextBlock data={getKnownData(data)} />
);

export default DefaultContextType;

const StyledContextBlock = styled(ContextBlock)`
  pre {
    padding: 0;
    margin-left: 10px;
  }
`;

const StyledWrapper = styled('div')`
  background-color: green;
  border: 1px solid red;
  ${Wrapper} {
    padding: 0;

    table {
      margin-bottom: 0;
    }
  }
`;
