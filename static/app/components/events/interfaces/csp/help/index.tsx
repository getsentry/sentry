import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconOpen} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import effectiveDirectives from './effectiveDirectives';

type EffectiveDirective = keyof typeof effectiveDirectives;

const linkOverrides = {'script-src': 'script-src_2'};

export type HelpProps = {
  data: {
    effective_directive: EffectiveDirective;
  };
};

const CSPHelp = ({data: {effective_directive: key}}: HelpProps) => {
  const getHelp = () => ({
    __html: effectiveDirectives[key],
  });

  const getLinkHref = () => {
    const baseLink =
      'https://developer.mozilla.org/en-US/docs/Web/Security/CSP/CSP_policy_directives#';

    if (key in linkOverrides) {
      return `${baseLink}${linkOverrides[key]}`;
    }

    return `${baseLink}${key}`;
  };

  const getLink = () => {
    const href = getLinkHref();

    return (
      <StyledExternalLink href={href}>
        {'developer.mozilla.org'}
        <IconOpen size="xs" className="external-icon" />
      </StyledExternalLink>
    );
  };

  return (
    <div>
      <h4>
        <code>{key}</code>
      </h4>
      <blockquote dangerouslySetInnerHTML={getHelp()} />
      <StyledP>
        <span>{'\u2014 MDN ('}</span>
        <span>{getLink()}</span>
        <span>{')'}</span>
      </StyledP>
    </div>
  );
};

export default CSPHelp;

const StyledP = styled('p')`
  text-align: right;
  display: grid;
  grid-template-columns: repeat(3, max-content);
  gap: ${space(0.25)};
`;

const StyledExternalLink = styled(ExternalLink)`
  display: inline-flex;
  align-items: center;
`;
