import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {ColorOrAlias, Theme} from 'sentry/utils/theme';

export function ColorPalette({
  name,
  palette,
}: {
  name: string;
  palette: Array<Array<{color: ColorOrAlias; text: string}>>;
}) {
  const theme = useTheme();

  return (
    <ColorPaletteGrid>
      {palette.map((section, i) => {
        return (
          <ColorPaletteList key={`${name}-${i}`}>
            {section.map((color, index) => {
              return (
                <ColorCardContainer
                  key={`${name}-${color.color}-${index}`}
                  style={{
                    backgroundColor: theme[color.color as keyof Theme] as string,
                    color: theme[color.text as keyof Theme] as string,
                  }}
                >
                  <strong>{color.color}</strong>
                  <div>{theme[color.color as keyof Theme] as string}</div>
                </ColorCardContainer>
              );
            })}
          </ColorPaletteList>
        );
      })}
    </ColorPaletteGrid>
  );
}

const ColorPaletteList = styled('ul')`
  padding: 0px;
  margin: 0px;
  list-style: none;
`;

const ColorPaletteGrid = styled('div')`
  margin: 0px;
  padding: 0px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};
`;

const ColorCardContainer = styled('li')`
  background-color: ${p => p.theme.background};

  padding: ${space(2)};
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};

  strong {
    font-size: ${p => p.theme.fontSizeMedium};
  }

  &:first-child {
    border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  }
  &:last-child {
    border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  }
  &:first-child:last-child {
    border-radius: ${p => p.theme.borderRadius};
  }
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;
