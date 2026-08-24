import styled from '@emotion/styled';

import {t} from 'sentry/locale';

type Props = {
  message: React.ReactNode;
  highlightMessage?: React.ReactNode;
};

export function SearchInvalidTag({message, highlightMessage}: Props) {
  return (
    <Invalid>
      <span>{message}</span>
      <Highlight>
        {highlightMessage ?? t('See all searchable properties in the docs.')}
      </Highlight>
    </Invalid>
  );
}

const Invalid = styled('span')`
  font-size: ${p => p.theme.font.size.sm};
  font-family: ${p => p.theme.font.family.sans};
  color: ${p => p.theme.colors.gray500};

  code {
    font-weight: ${p => p.theme.font.weight.sans.medium};
    padding: 0;
  }
  display: flex;
  gap: ${p => p.theme.space['2xs']};
  width: 100%;
`;

const Highlight = styled('strong')`
  color: ${p => p.theme.tokens.interactive.link.accent.rest};
`;
