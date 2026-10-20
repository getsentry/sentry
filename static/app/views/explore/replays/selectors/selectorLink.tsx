import styled from '@emotion/styled';

import {CodeBlock} from '@sentry/scraps/code';
import {Container, Grid} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {TextOverflow} from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';
import {WiderHovercard} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';

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
    <Grid gap="md" flow="row">
      {t('Search for replays with clicks on the element')}
      <Container overflow="scroll">
        <CodeBlock hideCopyButton language="javascript">
          {value}
        </CodeBlock>
      </Container>
    </Grid>
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
