import React from 'react';
import styled from '@emotion/styled';

import {IconOpen} from 'app/icons';
import ExternalLink from 'app/components/links/externalLink';
import space from 'app/styles/space';

import effectiveDirectives from './effectiveDirectives';

type EffectiveDirective = keyof typeof effectiveDirectives;

const linkOverrides = {'script-src': 'script-src_2'};

type Props = {
  data: {
    effective_directive: EffectiveDirective;
  };
};

const CSPHelp = ({data: {effective_directive: key}}: Props) => {
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
      <React.Fragment>
        <ExternalLink href={href}>developer.mozilla.org</ExternalLink>
        <ExternalLink href={href} className="external-icon">
          <IconOpen size="xs" />
        </ExternalLink>
      </React.Fragment>
    );
  };

  return (
    <div>
      <h4>
        <code>{key}</code>
      </h4>
      <blockquote dangerouslySetInnerHTML={getHelp()} />
      <StyledP>
        <span>{'— MDN ('}</span>
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
  grid-gap: ${space(0.25)};
`;
