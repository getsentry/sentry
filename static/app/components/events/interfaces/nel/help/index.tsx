import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconOpen} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import nelProperties from './nelProperties';

type NelProperty = keyof typeof nelProperties;

const linkOverrides = {'script-src': 'script-src_2'};

export type HelpProps = {
  data: {
    property: NelProperty;
  };
};

function NELHelp({data: {property: key}}: HelpProps) {
  const getHelp = () => ({
    __html: nelProperties[key],
  });

  const getLinkHref = () => {
    const baseLink =
      'https://developer.mozilla.org/en-US/docs/Web/HTTP/Network_Error_Logging#error_reports';

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
}

export default NELHelp;

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
