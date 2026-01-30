import styled from '@emotion/styled';
import * as qs from 'query-string';

import {Link} from '@sentry/scraps/link';

import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {SpanFields, type ModuleName} from 'sentry/views/insights/types';

const {SPAN_OP} = SpanFields;

interface Props {
  description: React.ReactNode;
  // extra query params to add to the link
  moduleName: ModuleName.DB | ModuleName.RESOURCE;
  projectId: number;
  extraLinkQueryParams?: Record<string, string>;
  group?: string;
  spanOp?: string;
}

export function SpanGroupDetailsLink({
  moduleName,
  group,
  projectId,
  spanOp,
  description,
  extraLinkQueryParams,
}: Props) {
  const location = useLocation();

  const moduleURL = useModuleURL(moduleName);

  const queryString = {
    ...location.query,
    project: projectId,
    ...(spanOp ? {[SPAN_OP]: spanOp} : {}),
    ...(extraLinkQueryParams ? extraLinkQueryParams : {}),
  };

  return (
    <OverflowEllipsisTextContainer>
      {group ? (
        <StyledLink
          to={normalizeUrl(
            `${moduleURL}/spans/span/${group}/?${qs.stringify(queryString)}`
          )}
        >
          {description}
        </StyledLink>
      ) : (
        description
      )}
    </OverflowEllipsisTextContainer>
  );
}

const StyledLink = styled(Link)`
  display: inline-block;
  min-width: ${p => p.theme.space['2xl']};
`;
