import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconOpen} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import nelProperties from './nelProperties';

function NELHelp({data}) {
  const getLink = () => {
    const href =
      'https://developer.mozilla.org/en-US/docs/Web/HTTP/Network_Error_Logging#error_reports';

    return (
      <StyledExternalLink href={href}>
        {'developer.mozilla.org'}
        <IconOpen size="xs" className="external-icon" />
      </StyledExternalLink>
    );
  };

  let output = '';
  for (const [nelProperty, nelExplanation] of Object.entries(nelProperties)) {
    output += `<span><b>${nelProperty}</b></span>: <span>${nelExplanation}</span><br/>`;
  }

  return (
    <div>
      <h4>
        <code>{data.message}</code>
      </h4>
      <blockquote>{data.culprit}</blockquote>
      <blockquote dangerouslySetInnerHTML={{__html: output}} />
      <StyledP>
        <span>{'\u2023 MDN ('}</span>
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
