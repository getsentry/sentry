import {Container} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import {
  commentedInvestigation,
  commentedInvestigationComments,
} from 'sentry/views/investigations/__stories__/commentStoryFixtures';
import {InvestigationFixtureApi} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {StoryTopBar} from 'sentry/views/investigations/__stories__/storyTopBar';
import {InvestigationBootstrapPage} from 'sentry/views/investigations/detail';

export default Storybook.story('Investigations — Comments', story => {
  story('Comments on the page and its blocks', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-comments"
      details={[commentedInvestigation]}
      comments={{[commentedInvestigation.id]: commentedInvestigationComments}}
    >
      <Container minHeight="720px" border="primary" radius="md" overflow="hidden">
        <StoryTopBar>
          <InvestigationBootstrapPage investigationId={commentedInvestigation.id} />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));
});
