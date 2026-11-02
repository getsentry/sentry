import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {QUERY_API_CLIENT} from 'sentry/utils/api/apiFetch';
import {InvestigationsPage} from 'sentry/views/investigations';
import {
  commentStoryAuthors,
  commentedInvestigation,
  commentedInvestigationComments,
} from 'sentry/views/investigations/__stories__/commentStoryFixtures';
import {InvestigationFixtureApi} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {InvestigationActivity} from 'sentry/views/investigations/activity/investigationActivity';
import {InvestigationBootstrapPage} from 'sentry/views/investigations/detail';
import {
  InvestigationBlockFixture,
  InvestigationCommentFixture,
  InvestigationDetailFixture,
  InvestigationListItemFixture,
  InvestigationOrchestrationFixture,
} from 'sentry/views/investigations/fixtures';
import {InvestigationHypotheses} from 'sentry/views/investigations/hypotheses/investigationHypotheses';

const organization = OrganizationFixture({
  features: ['investigations'],
  openMembership: true,
});

describe('InvestigationFixtureApi', () => {
  it('serves and mutates list fixtures without the backend', async () => {
    const investigation = InvestigationListItemFixture({
      id: 'checkout-latency',
      title: 'Checkout latency after payments-api deploy',
    });

    render(
      <InvestigationFixtureApi
        organizationSlug="storybook-investigations-list-test"
        list={[investigation]}
      >
        <InvestigationsPage />
      </InvestigationFixtureApi>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname:
              '/organizations/storybook-investigations-list-test/seer/investigations/',
          },
        },
      }
    );

    expect(await screen.findByText(investigation.title)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {name: `Favorite ${investigation.title}`})
    );

    expect(
      await screen.findByRole('button', {name: `Unfavorite ${investigation.title}`})
    ).toBeInTheDocument();
  });

  it('supports detail mutations without the backend', async () => {
    const investigation = InvestigationDetailFixture({
      id: 'invoice-timeouts',
      title: 'Invoice PDF timeouts in eu-west-1',
      blocks: [],
    });

    render(
      <InvestigationFixtureApi
        organizationSlug="storybook-investigation-detail-test"
        details={[investigation]}
      >
        <InvestigationBootstrapPage investigationId={investigation.id} />
      </InvestigationFixtureApi>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/storybook-investigation-detail-test/seer/investigations/${investigation.id}/`,
          },
        },
      }
    );

    expect(await screen.findByRole('textbox', {name: 'Investigation title'})).toHaveValue(
      investigation.title
    );

    // Renaming is the detail mutation the page drives itself. Blurring the
    // field cancels the debounce and writes immediately, so this needs no timer.
    const titleField = screen.getByRole('textbox', {name: 'Investigation title'});
    await userEvent.clear(titleField);
    await userEvent.type(titleField, 'Invoice PDF timeouts everywhere');
    await userEvent.tab();

    // Read back through the fixture API rather than the field: the input would
    // show the new title from the optimistic cache update either way, so only a
    // fresh fetch proves the fixture backend actually stored it.
    await waitFor(async () => {
      const stored = await QUERY_API_CLIENT.requestPromise(
        `/organizations/storybook-investigation-detail-test/notebooks/${investigation.id}/`
      );
      expect(stored.title).toBe('Invoice PDF timeouts everywhere');
    });
  });

  it('keeps fixture IDs and block positions unique across mutations', async () => {
    const firstBlock = InvestigationBlockFixture({
      id: 'storybook-query-1',
      kind: 'query',
      position: 0,
    });
    const secondBlock = InvestigationBlockFixture({
      id: 'storybook-query-2',
      kind: 'query',
      position: 1,
    });
    const investigation = InvestigationDetailFixture({
      id: 'fixture-id-collisions',
      blocks: [firstBlock, secondBlock],
    });
    const baseUrl = `/organizations/storybook-fixture-id-test/notebooks/${investigation.id}/`;

    render(
      <InvestigationFixtureApi
        organizationSlug="storybook-fixture-id-test"
        details={[investigation]}
      >
        <div>Fixture ready</div>
      </InvestigationFixtureApi>,
      {organization}
    );

    expect(await screen.findByText('Fixture ready')).toBeInTheDocument();

    await QUERY_API_CLIENT.requestPromise(`${baseUrl}blocks/${firstBlock.id}/`, {
      method: 'DELETE',
    });
    const addedBlock = await QUERY_API_CLIENT.requestPromise(`${baseUrl}blocks/`, {
      method: 'POST',
      data: {
        kind: 'query',
        title: 'New query',
      },
    });
    const firstDuplicate = await QUERY_API_CLIENT.requestPromise(`${baseUrl}duplicate/`, {
      method: 'POST',
    });
    const secondDuplicate = await QUERY_API_CLIENT.requestPromise(
      `${baseUrl}duplicate/`,
      {method: 'POST'}
    );

    expect(addedBlock).toMatchObject({
      id: 'storybook-query-2-2',
      position: 2,
    });
    expect(firstDuplicate.id).toBe('fixture-id-collisions-copy');
    expect(secondDuplicate.id).toBe('fixture-id-collisions-copy-2');
  });

  // These mirror the "Live, against a mocked orchestration API" story. The
  // stories route is where this UI gets reviewed, so a fixture that no longer
  // satisfies the component leaves a broken page rather than a failing build —
  // rendering the story's contents here is what catches that.
  describe('orchestration', () => {
    function renderStoryHypotheses(
      run = InvestigationOrchestrationFixture(),
      investigationId = 'investigation-1'
    ) {
      return render(
        <InvestigationFixtureApi
          organizationSlug="hypotheses-story"
          details={[InvestigationDetailFixture({id: investigationId, blocks: []})]}
          orchestration={{[investigationId]: run}}
        >
          <InvestigationHypotheses investigationId={investigationId} />
        </InvestigationFixtureApi>,
        {organization}
      );
    }

    it('serves the projection to the hypothesis row', async () => {
      renderStoryHypotheses();
      // The panel is up before the projection lands, so wait for the real
      // cards before opening it.
      await screen.findAllByTestId('investigation-hypothesis');
      await userEvent.click(screen.getByRole('button', {name: /Hypotheses/}));

      expect(await screen.findAllByTestId('investigation-hypothesis')).toHaveLength(3);
      // A settled hypothesis folds its checks behind a toggle.
      expect(screen.getByRole('button', {name: 'Show 3 steps'})).toBeInTheDocument();
    });

    it('applies a disposition command and returns the new projection', async () => {
      renderStoryHypotheses();
      // The panel is up before the projection lands, so wait for the real
      // cards before opening it.
      await screen.findAllByTestId('investigation-hypothesis');
      await userEvent.click(screen.getByRole('button', {name: /Hypotheses/}));

      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Actions for An external SSO provider slowed the response',
        })
      );
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Accept'}));

      // The command response carries the updated projection, so the card
      // changes without another read.
      expect(await screen.findByText('Accepted by you')).toBeInTheDocument();
      // Accepting settles the hypothesis, so its edge picks up the accent.
      expect(screen.getAllByTestId('investigation-hypothesis')[1]).toHaveAttribute(
        'data-border',
        'accent'
      );
    });

    it('clears a disposition back to the agent verdict', async () => {
      renderStoryHypotheses();
      // The panel is up before the projection lands, so wait for the real
      // cards before opening it.
      await screen.findAllByTestId('investigation-hypothesis');
      await userEvent.click(screen.getByRole('button', {name: /Hypotheses/}));

      const trigger = await screen.findByRole('button', {
        name: 'Actions for An external SSO provider slowed the response',
      });
      await userEvent.click(trigger);
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Accept'}));
      await screen.findByText('Accepted by you');

      await userEvent.click(trigger);
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Clear decision'})
      );

      expect(await screen.findByText('Refuted')).toBeInTheDocument();
      // Back to the agent's verdict, so the edge breaks again.
      expect(screen.getAllByTestId('investigation-hypothesis')[1]).toHaveAttribute(
        'data-border',
        'dashed'
      );
    });

    it('puts a retried hypothesis back into investigation', async () => {
      renderStoryHypotheses();
      // The panel is up before the projection lands, so wait for the real
      // cards before opening it.
      await screen.findAllByTestId('investigation-hypothesis');
      await userEvent.click(screen.getByRole('button', {name: /Hypotheses/}));

      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Actions for Session validation created a shared bottleneck',
        })
      );
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Investigate again'})
      );

      expect(await screen.findByText('Verifying…')).toBeInTheDocument();
      expect(screen.getByText('Inspect session and middleware spans')).toBeVisible();
      expect(screen.queryByRole('listitem', {current: 'step'})).not.toBeInTheDocument();
    });
  });

  it('keeps product headings out of the Scraps page index', async () => {
    const investigation = InvestigationDetailFixture({id: 'page-index', blocks: []});

    render(
      <InvestigationFixtureApi
        organizationSlug="storybook-page-index-test"
        details={[investigation]}
      >
        <InvestigationActivity investigation={investigation} />
      </InvestigationFixtureApi>,
      {organization}
    );

    // The Scraps table of contents skips headings inside story demos.
    expect(
      (await screen.findByRole('heading', {name: 'Activity'})).closest(
        '[data-storybook-demo]'
      )
    ).not.toBeNull();
  });

  describe('comments', () => {
    it('serves no comments by default, so detail stories render the Activity section', async () => {
      const investigation = InvestigationDetailFixture({
        id: 'no-comments',
        blocks: [],
      });

      render(
        <InvestigationFixtureApi
          organizationSlug="storybook-comments-default-test"
          details={[investigation]}
        >
          <InvestigationActivity investigation={investigation} />
        </InvestigationFixtureApi>,
        {organization}
      );

      expect(await screen.findByText('Investigation first created')).toBeInTheDocument();
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it('serves the Activity story comments newest first', async () => {
      render(
        <InvestigationFixtureApi
          organizationSlug="storybook-comments-test"
          details={[commentedInvestigation]}
          comments={{
            [commentedInvestigation.id]: commentedInvestigationComments.toReversed(),
          }}
        >
          <InvestigationActivity investigation={commentedInvestigation} />
        </InvestigationFixtureApi>,
        {organization}
      );

      const rows = await screen.findAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('Grace Hopper commented');
      expect(rows[1]).toHaveTextContent('on Invoice generation duration');
      expect(screen.getByText('on a deleted block')).toBeInTheDocument();
      expect(screen.getByText('Unknown user commented')).toBeInTheDocument();
    });

    it('posts comments as the story viewer', async () => {
      const investigation = InvestigationDetailFixture({id: 'posting', blocks: []});

      render(
        <InvestigationFixtureApi
          organizationSlug="storybook-comments-post-test"
          details={[investigation]}
        >
          <InvestigationActivity investigation={investigation} />
        </InvestigationFixtureApi>,
        {organization}
      );

      const composer = await screen.findByRole('combobox', {name: 'Add a comment'});
      // user-event does not yet recognize contenteditable="plaintext-only".
      composer.setAttribute('contenteditable', 'true');
      await userEvent.type(composer, 'Rolling back the autoscaling change.{Enter}');

      expect(await screen.findByText('Ada Lovelace commented')).toBeInTheDocument();
      expect(
        screen.getByText('Rolling back the autoscaling change.')
      ).toBeInTheDocument();
    });

    it('edits and deletes comments, with actions only for the story viewer', async () => {
      const investigation = InvestigationDetailFixture({id: 'editing', blocks: []});
      const commentsUrl = `/organizations/storybook-comments-edit-test/notebooks/${investigation.id}/comments/`;

      render(
        <InvestigationFixtureApi
          organizationSlug="storybook-comments-edit-test"
          details={[investigation]}
          comments={{
            [investigation.id]: [
              InvestigationCommentFixture({
                id: 'mine',
                author: commentStoryAuthors.ADA,
                body: 'First draft',
              }),
              InvestigationCommentFixture({
                id: 'theirs',
                author: commentStoryAuthors.GRACE,
                body: 'Not mine',
              }),
            ],
          }}
        >
          <InvestigationActivity investigation={investigation} />
        </InvestigationFixtureApi>,
        {organization}
      );

      expect(
        await screen.findAllByRole('button', {name: 'Comment actions'})
      ).toHaveLength(1);

      await QUERY_API_CLIENT.requestPromise(`${commentsUrl}mine/`, {
        method: 'PUT',
        data: {body: 'Second draft'},
      });
      await QUERY_API_CLIENT.requestPromise(`${commentsUrl}theirs/`, {method: 'DELETE'});

      expect(await QUERY_API_CLIENT.requestPromise(commentsUrl)).toEqual([
        expect.objectContaining({id: 'mine', body: 'Second draft'}),
      ]);
    });

    it('opens block threads in a drawer that reads the fixture', async () => {
      render(
        <InvestigationFixtureApi
          organizationSlug="storybook-comments-drawer-test"
          details={[commentedInvestigation]}
          comments={{[commentedInvestigation.id]: commentedInvestigationComments}}
        >
          <InvestigationBootstrapPage investigationId={commentedInvestigation.id} />
        </InvestigationFixtureApi>,
        {
          organization,
          initialRouterConfig: {
            location: {
              pathname: `/organizations/storybook-comments-drawer-test/seer/investigations/${commentedInvestigation.id}/`,
              query: {comments: 'open', commentsBlock: 'commented-query'},
            },
          },
        }
      );

      const drawer = await screen.findByRole('complementary', {name: 'Block comments'});
      expect(
        await within(drawer).findByRole('heading', {
          name: 'Comments on Invoice generation duration',
        })
      ).toBeInTheDocument();
      // Oldest first, and only this block's comments.
      const thread = await within(drawer).findByRole('list', {name: 'Block comments'});
      expect(
        within(thread)
          .getAllByRole('listitem')
          .map(item => item.textContent)
      ).toEqual([
        expect.stringContaining('p95 jumps right at 13:40'),
        expect.stringContaining('worker minimum'),
        expect.stringContaining('Reverting the minimum instance count'),
      ]);
    });

    it('counts comments per block', async () => {
      render(
        <InvestigationFixtureApi
          organizationSlug="storybook-comment-counts-test"
          details={[commentedInvestigation]}
          comments={{[commentedInvestigation.id]: commentedInvestigationComments}}
        >
          <div>Fixture ready</div>
        </InvestigationFixtureApi>,
        {organization}
      );

      expect(await screen.findByText('Fixture ready')).toBeInTheDocument();
      expect(
        await QUERY_API_CLIENT.requestPromise(
          `/organizations/storybook-comment-counts-test/notebooks/${commentedInvestigation.id}/comment-counts/`
        )
      ).toEqual({
        'commented-query': 3,
        'commented-notes': 1,
        'deleted-cdn-check': 1,
      });
    });
  });
});
