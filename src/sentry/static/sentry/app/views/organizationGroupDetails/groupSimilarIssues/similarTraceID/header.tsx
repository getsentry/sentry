import React from 'react';
import styled from '@emotion/styled';

import Clipboard from 'app/components/clipboard';
import {IconCopy} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {getShortEventId} from 'app/utils/events';

type Props = {
  traceID?: string;
};

const Header = ({traceID}: Props) => (
  <Wrapper>
    <h4>{t('Issues with the same trace ID')}</h4>
    {traceID ? (
      <Clipboard value={traceID}>
        <ClipboardWrapper>
          <span>{getShortEventId(traceID)}</span>
          <IconCopy />
        </ClipboardWrapper>
      </Clipboard>
    ) : (
      <span>{'-'}</span>
    )}
  </Wrapper>
);

export default Header;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray500};
  h4 {
    font-size: ${p => p.theme.headerFontSize};
    color: ${p => p.theme.gray700};
    font-weight: normal;
    margin-bottom: 0;
  }
`;

const ClipboardWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  align-items: center;
  &:hover {
    cursor: pointer;
  }
`;
