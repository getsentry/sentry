import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  message: React.ReactNode;
  docLink?: string;
  highlightMessage?: React.ReactNode;
};

export function SearchInvalidTag({message, highlightMessage, docLink}: Props) {
  return (
    <Invalid
      onClick={event => {
        if (!docLink) {
          return;
        }
        event.stopPropagation();
        window.open(docLink);
      }}
    >
      <span>{message}</span>
      <Highlight>
        {highlightMessage ?? t('See all searchable properties in the docs.')}
      </Highlight>
    </Invalid>
  );
}

const Invalid = styled(`span`)`
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.family};
  color: ${p => p.theme.gray400};

  code {
    font-weight: ${p => p.theme.fontWeightBold};
    padding: 0;
  }
  display: flex;
  gap: ${space(0.25)};
  width: 100%;
`;

const Highlight = styled(`strong`)`
  color: ${p => p.theme.linkColor};
`;
