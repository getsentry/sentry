import {css} from '@emotion/react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {SchemaHintsSection} from 'sentry/views/explore/components/schemaHints/schemaHintsList';

export const ExploreControlSection = styled('aside')<{expanded: boolean}>`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    border-bottom: none;
    ${p =>
      p.expanded
        ? css`
            width: 343px; /* 300px for the toolbar + padding */
            padding: ${p.theme.space.xl} ${p.theme.space.lg} ${p.theme.space.md}
              ${p.theme.space['3xl']};
            border-right: 1px solid ${p.theme.tokens.border.primary};
          `
        : css`
            overflow: hidden;
            width: 0px;
            padding: 0px;
            border-right: none;
          `}
  }
`;

export const ExploreContentSection = styled('section')<{expanded: boolean}>`
  background-color: ${p => p.theme.backgroundSecondary};
  flex: 1 1 auto;
  min-width: 0;

  padding-top: ${p => p.theme.space.md};
  padding-right: ${p => p.theme.space.xl};
  padding-bottom: ${p => p.theme.space['2xl']};
  padding-left: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    ${p =>
      p.expanded
        ? css`
            padding: ${p.theme.space.md} ${p.theme.space['3xl']} ${p.theme.space['2xl']}
              ${p.theme.space.lg};
          `
        : css`
            padding: ${p.theme.space.md} ${p.theme.space['3xl']} ${p.theme.space['2xl']}
              ${p.theme.space['3xl']};
          `}
  }
`;

export const ExploreFilterSection = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.md};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: minmax(300px, auto) 1fr;
  }
`;

export const ExploreSchemaHintsSection = styled(SchemaHintsSection)`
  margin-top: ${p => p.theme.space.md};
  margin-bottom: 0px;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    margin-top: ${p => p.theme.space.md};
    margin-bottom: 0px;
  }
`;

export const ExploreBodySearch = styled(Layout.Body)`
  flex-grow: 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  padding-bottom: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding-bottom: ${p => p.theme.space.xl};
  }
`;

export const ExploreBodyContent = styled('div')`
  background-color: ${p => p.theme.tokens.background.primary};
  flex-grow: 1;

  display: flex;
  flex-direction: column;
  padding: 0px;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: flex;
    flex-direction: row;
    padding: 0px;
    gap: 0px;
  }
`;
