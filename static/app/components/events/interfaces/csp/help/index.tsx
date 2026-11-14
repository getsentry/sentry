import styled from '@emotion/styled';
import {IconOpen} from '@sentry/icons/open';

import {ExternalLink} from '@sentry/scraps/link';

import {effectiveDirectives} from './effectiveDirectives';

type EffectiveDirective = keyof typeof effectiveDirectives;

const linkOverrides = {'script-src': 'script-src_2'};

export type HelpProps = {
  data: {
    effective_directive: EffectiveDirective;
  };
};

export function CSPHelp({data: {effective_directive: key}}: HelpProps) {
  const getLinkHref = () => {
    const baseLink =
      'https://developer.mozilla.org/en-US/docs/Web/Security/CSP/CSP_policy_directives#';

    if (key in linkOverrides) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return `${baseLink}${linkOverrides[key]}`;
    }

    return `${baseLink}${key}`;
  };

  const link = (
    <StyledExternalLink href={getLinkHref()}>
      {'developer.mozilla.org'}
      <StyledIconOpen size="xs" />
    </StyledExternalLink>
  );

  return (
    <div>
      <h4>
        <code>{key}</code>
      </h4>
      <blockquote>{effectiveDirectives[key]}</blockquote>
      <StyledP>
        <span>{'\u2014 MDN ('}</span>
        <span>{link}</span>
        <span>{')'}</span>
      </StyledP>
    </div>
  );
}

const StyledP = styled('p')`
  text-align: right;
  display: grid;
  grid-template-columns: repeat(3, max-content);
  gap: ${p => p.theme.space['2xs']};
`;

const StyledExternalLink = styled(ExternalLink)`
  display: inline-flex;
  align-items: center;
`;

const StyledIconOpen = styled(IconOpen)`
  margin: 0 ${p => p.theme.space.xs};
  color: ${p => p.theme.tokens.graphics.neutral.vibrant};
  transition: color ${p => p.theme.motion.smooth.fast};

  &:hover {
    color: ${p => p.theme.tokens.content.secondary};
  }
`;
