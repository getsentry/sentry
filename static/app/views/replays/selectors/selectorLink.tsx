import styled from '@emotion/styled';

import {CodeBlock} from 'sentry/components/core/code';
import {Link} from 'sentry/components/core/link';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {WiderHovercard} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

export function SelectorLink({
  value,
  selectorQuery,
  projectId,
}: {
  projectId: string;
  selectorQuery: string;
  value: string;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const hovercardContent = (
    <TooltipContainer>
      {t('Search for replays with clicks on the element')}
      <SelectorScroll>
        <CodeBlock hideCopyButton language="javascript">
          {value}
        </CodeBlock>
      </SelectorScroll>
    </TooltipContainer>
  );

  const pathname = makeReplaysPathname({
    path: '/',
    organization,
  });

  return (
    <StyledTextOverflow>
      <WiderHovercard position="right" body={hovercardContent}>
        <StyledLink
          to={{
            pathname,
            query: {
              ...location.query,
              query: selectorQuery,
              cursor: undefined,
              project: projectId,
            },
          }}
        >
          <TextOverflow>{value}</TextOverflow>
        </StyledLink>
      </WiderHovercard>
    </StyledTextOverflow>
  );
}

const StyledLink = styled(Link)`
  min-width: 0;
`;

const StyledTextOverflow = styled(TextOverflow)`
  color: ${p => p.theme.tokens.content.accent};
`;

const TooltipContainer = styled('div')`
  display: grid;
  grid-auto-flow: row;
  gap: ${space(1)};
`;

const SelectorScroll = styled('div')`
  overflow: scroll;
`;
