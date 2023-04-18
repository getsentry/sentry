import styled from '@emotion/styled';

import Clipboard from 'sentry/components/clipboard';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getShortEventId} from 'sentry/utils/events';

type Props = {
  traceID?: string;
};

function Header({traceID}: Props) {
  return (
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
}

export default Header;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray300};
  h4 {
    font-size: ${p => p.theme.headerFontSize};
    color: ${p => p.theme.textColor};
    font-weight: normal;
    margin-bottom: 0;
  }
`;

const ClipboardWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
  &:hover {
    cursor: pointer;
  }
`;
