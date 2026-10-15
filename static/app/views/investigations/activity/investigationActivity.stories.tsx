import {Container} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import {
  commentedInvestigation,
  commentedInvestigationComments,
} from 'sentry/views/investigations/__stories__/commentStoryFixtures';
import {InvestigationFixtureApi} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {InvestigationActivity} from 'sentry/views/investigations/activity/investigationActivity';
import {InvestigationDetailFixture} from 'sentry/views/investigations/fixtures';

const uncommentedInvestigation = InvestigationDetailFixture({
  id: 'uncommented-investigation',
  dateCreated: '2026-08-27T14:08:00Z',
  blocks: [],
});
const archivedInvestigation = {...commentedInvestigation, status: 'archived' as const};

export default Storybook.story('Investigations — Activity', story => {
  story('Page and block comments', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity"
      details={[commentedInvestigation]}
      comments={{[commentedInvestigation.id]: commentedInvestigationComments}}
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={commentedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('No comments yet', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-empty"
      details={[uncommentedInvestigation]}
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={uncommentedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Archived investigation', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-archived"
      details={[archivedInvestigation]}
      comments={{[archivedInvestigation.id]: commentedInvestigationComments.slice(0, 2)}}
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={archivedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('More than 100 comments', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-older"
      details={[commentedInvestigation]}
      comments={{[commentedInvestigation.id]: commentedInvestigationComments.slice(0, 2)}}
      commentPageLinks={{
        [commentedInvestigation.id]:
          '<link>; rel="previous"; results="false"; cursor="0:0:1", <link>; rel="next"; results="true"; cursor="0:100:0"',
      }}
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={commentedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Loading', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-loading"
      mode="loading"
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={uncommentedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Error', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-error"
      mode="error"
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={uncommentedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));
});
