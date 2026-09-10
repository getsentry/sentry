import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {QUERY_API_CLIENT} from 'sentry/utils/queryClient';
import {InvestigationsPage} from 'sentry/views/investigations';
import {InvestigationFixtureApi} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {InvestigationBootstrapPage} from 'sentry/views/investigations/detail';
import {
  InvestigationBlockFixture,
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
              '/organizations/storybook-investigations-list-test/explore/investigations/',
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
            pathname: `/organizations/storybook-investigation-detail-test/explore/investigations/${investigation.id}/`,
          },
        },
      }
    );

    expect(await screen.findByRole('textbox', {name: 'Investigation title'})).toHaveValue(
      investigation.title
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Add query cell (debug only)'})
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Cell title'}),
      'Slow checkouts'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Cell instructions'}),
      'Compare checkout p95 before and after the deploy.'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Add cell'}));

    expect(
      await screen.findByRole('button', {name: 'Toggle Slow checkouts'})
    ).toBeInTheDocument();
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
    const baseUrl = `/organizations/storybook-fixture-id-test/investigations/${investigation.id}/`;

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

      expect(await screen.findAllByTestId('investigation-hypothesis')).toHaveLength(3);
      expect(
        screen.getByRole('heading', {
          name: 'Database or cache degradation delayed the response',
        })
      ).toBeInTheDocument();
      expect(screen.getByText('Supported · 86% Confidence')).toBeInTheDocument();
      expect(
        screen.getByText('The delay begins before the document reaches the browser.')
      ).toBeInTheDocument();
    });

    it('applies a disposition command and returns the new projection', async () => {
      renderStoryHypotheses();

      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Actions for An external SSO provider slowed the response',
        })
      );
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Accept'}));

      // The command response carries the updated projection, so the card
      // changes without another read.
      expect(
        await screen.findByText('Accepted by you · 91% Confidence')
      ).toBeInTheDocument();
      // Accepting settles the hypothesis, so its edge picks up the accent.
      expect(screen.getAllByTestId('investigation-hypothesis')[1]).toHaveAttribute(
        'data-border',
        'accent'
      );
    });

    it('clears a disposition back to the agent verdict', async () => {
      renderStoryHypotheses();

      const trigger = await screen.findByRole('button', {
        name: 'Actions for An external SSO provider slowed the response',
      });
      await userEvent.click(trigger);
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Accept'}));
      await screen.findByText('Accepted by you · 91% Confidence');

      await userEvent.click(trigger);
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Clear decision'})
      );

      expect(await screen.findByText('Refuted · 91% Confidence')).toBeInTheDocument();
      // Back to the agent's verdict, so the edge breaks again.
      expect(screen.getAllByTestId('investigation-hypothesis')[1]).toHaveAttribute(
        'data-border',
        'dashed'
      );
    });

    it('puts a retried hypothesis back into investigation', async () => {
      renderStoryHypotheses();

      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Actions for Session validation created a shared bottleneck',
        })
      );
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Investigate again'})
      );

      expect(await screen.findByText('Investigating')).toBeInTheDocument();
      expect(screen.getAllByText('Queued.').length).toBeGreaterThan(0);
    });
  });
});
