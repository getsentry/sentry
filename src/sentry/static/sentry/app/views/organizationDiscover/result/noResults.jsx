import React from 'react';
import styled from 'react-emotion';
import {t} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

export default class NoResults extends React.Component {
  render() {
    return (
      <EmptyMessage>
        <MessageContent>
          <InlineSvg src="icon-circle-exclamation" width="34px" />
          {t('No Results')}
        </MessageContent>
      </EmptyMessage>
    );
  }
}

const MessageContent = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: 1em;
`;
