import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import {Wrapper} from 'sentry/components/clippedBox';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {Event} from 'sentry/types/event';

import {
  Props as RichHttpContentClippedBoxKeyValueListProps,
  RichHttpContentClippedBoxKeyValueList,
} from '../interfaces/request/richHttpContentClippedBoxKeyValueList';

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
          key: 'response-headers',
          subject: startCase(key),
          value: (
            <StyledWrapper>
              <RichHttpContentClippedBoxKeyValueList
                title=""
                data={value as RichHttpContentClippedBoxKeyValueListProps['data']}
              />
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

const DefaultContextType = ({data}: Props) => <ContextBlock data={getKnownData(data)} />;

export default DefaultContextType;

const StyledWrapper = styled('div')`
  .val-string {
    padding-left: 10px !important;
  }

  ${Wrapper} {
    padding: 0;

    table {
      margin-bottom: 0;
    }
  }
`;
