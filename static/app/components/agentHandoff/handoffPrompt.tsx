import {Fragment} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {InfoText} from '@sentry/scraps/info';

import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';

function promptParts<Code>(code: Code): [string, Code, string] {
  const guideUrl = `${ConfigStore.get('urlPrefix').replace(/\/$/, '')}/agent-handoff/`;
  return [
    `Follow the instructions verbatim at ${guideUrl}. Your handoff code is `,
    code,
    '.',
  ];
}

/**
 * The agent handoff prompt as the plaintext copied for the agent and as the styled
 * preview with its handoff code masked. Both come from one template so their wording
 * can't drift apart. The prompt is read by the agent, so it is intentionally not
 * translated.
 *
 * The plaintext takes the code because the code is only minted when the user copies.
 */
export function getHandoffPrompt() {
  const [start, maskedCode, end] = promptParts(
    <MaskedCode
      monospace
      variant="warning"
      title={t('The secret code authorizes your agent on your behalf')}
    >
      sntryh_****
    </MaskedCode>
  );

  return {
    plaintext: (code: string) => promptParts(`\`${code}\``).join(''),
    styledPrompt: (
      <Fragment>
        {start}
        {maskedCode}
        {end}
      </Fragment>
    ),
  };
}

export const accentSelection = (p: {theme: Theme}) => css`
  &::selection {
    background: ${p.theme.tokens.background.accent.vibrant};
    color: ${p.theme.tokens.content.onVibrant.light};
  }
`;

const MaskedCode = styled(InfoText)`
  background: ${p => p.theme.tokens.background.transparent.warning.muted};
  border-radius: ${p => p.theme.radius.sm};
  padding: 0 ${p => p.theme.space['2xs']};
  text-decoration: none;
  ${accentSelection}
`;
