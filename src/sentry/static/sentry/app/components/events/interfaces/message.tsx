import React from 'react';
import styled from '@emotion/styled';

import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';
import EventDataSection from 'app/components/events/eventDataSection';
import Annotated from 'app/components/events/meta/annotated';
import {t} from 'app/locale';
import {objectIsEmpty} from 'app/utils';
import space from 'app/styles/space';

type Props = {
  data: {
    formatted: string;
    params?: Record<string, any> | any[];
  };
};

const Message = ({data}: Props) => {
  const renderParams = () => {
    let params = data?.params;

    if (!params || objectIsEmpty(params)) {
      return null;
    }

    // NB: Always render params, regardless of whether they appear in the
    // formatted string due to structured logging frameworks, like Serilog. They
    // only format some parameters into the formatted string, but we want to
    // display all of them.

    if (Array.isArray(params)) {
      params = params.map((value, i) => [`#${i}`, value]);
    }

    return <KeyValueList data={params} isSorted={false} isContextData />;
  };

  return (
    <StyledEventDataSection type="message" title={t('Message')}>
      <Annotated object={data} objectKey="formatted">
        {value => <StyledPre>{value}</StyledPre>}
      </Annotated>
      {renderParams()}
    </StyledEventDataSection>
  );
};

const StyledPre = styled('pre')`
  background-color: inherit;
  padding: 0;
  border: 0;
  white-space: pre-wrap;
  word-break: break-all;
  box-shadow: none;
  margin-bottom: ${space(3)} !important;
`;

const StyledEventDataSection = styled(EventDataSection)`
  padding-bottom: ${space(3)};
`;

export default Message;
