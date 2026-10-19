import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {SavedFormula} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import FormulaBuilderPage from 'sentry/views/explore/savedFormulas/formulaBuilder';

function SavedFormulaFixture(params: Partial<SavedFormula> = {}): SavedFormula {
  return {
    id: '2',
    name: 'formula.apdex',
    dataset: 'spans',
    formula: '{count_satisfied} / count()',
    params: [{name: 'threshold', order: 0, type: 'number', value: ''}],
    references: [{name: 'count_satisfied', value: 'count_if(`span.duration:<100`)'}],
    type: 'number',
    unit: null,
    prebuilt: false,
    ...params,
  };
}

describe('FormulaBuilderPage', () => {
  const organization = OrganizationFixture({features: ['explore-saved-formulas']});

  function renderEditPage(formula: SavedFormula) {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/formulas/${formula.id}/`,
      body: formula,
    });

    render(<FormulaBuilderPage />, {
      organization,
      initialRouterConfig: {
        route: '/organizations/:orgId/explore/saved-formulas/:formulaId/',
        location: {
          pathname: `/organizations/${organization.slug}/explore/saved-formulas/${formula.id}/`,
        },
      },
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      body: [],
    });
  });

  it('allows editing a user formula', async () => {
    renderEditPage(SavedFormulaFixture());

    expect(await screen.findByRole('textbox', {name: 'Formula name'})).toBeEnabled();
    expect(
      screen.queryByText('Formulas built by Sentry cannot be edited.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
  });

  it('disables editing a prebuilt formula', async () => {
    renderEditPage(SavedFormulaFixture({prebuilt: true}));

    expect(
      await screen.findByText('Formulas built by Sentry cannot be edited.')
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Formula name'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Parameter name'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Reference name'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Dataset'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Unit'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Add Parameter'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Add Reference'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Remove parameter'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Remove reference'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
  });
});
