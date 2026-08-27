import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {InvestigationsPage} from 'sentry/views/investigations';
import {InvestigationBootstrapPage} from 'sentry/views/investigations/detail';
import {
  InvestigationDetailFixture,
  InvestigationListItemFixture,
} from 'sentry/views/investigations/fixtures';
import {InvestigationFixtureApi} from 'sentry/views/investigations/stories/investigationFixtureApi';

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
});
