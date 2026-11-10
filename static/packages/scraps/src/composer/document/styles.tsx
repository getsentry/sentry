import styled from '@emotion/styled';

import {codeBlockStyles} from '@sentry/scraps/codeBlock/styles';
import {ComposerEditor} from '@sentry/scraps/composer/styles';
import {Prose} from '@sentry/scraps/text';
import {getTextStyles} from '@sentry/scraps/text/text';
import {darkTheme} from '@sentry/scraps/theme';

export const DocumentEditor = styled(Prose.withComponent(ComposerEditor))`
  ${p => getTextStyles({theme: p.theme, size: 'md', density: 'comfortable'})};
  ${codeBlockStyles(darkTheme)};

  @media (hover: none) and (pointer: coarse) {
    font-size: ${p => p.theme.font.size.lg};
  }

  & > blockquote {
    margin-top: 0;
    margin-inline: ${p => p.theme.space.lg} 0;
    padding: 0 0 0 ${p => p.theme.space.xl};
    border-left: 1px solid ${p => p.theme.tokens.border.primary};
  }

  /* Lexical code blocks use bare code elements rather than pre > code. */
  && > code.language-block {
    display: block;
    overflow-x: auto;
    margin: 0 0 ${p => p.theme.space['2xl']};
    padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
    border-radius: ${p => p.theme.radius.md};
    color: var(--prism-base);
    background: var(--prism-block-background);
    font-size-adjust: none;
    text-box-trim: none;

    &:last-child {
      margin-bottom: 0;
    }
  }
`;
