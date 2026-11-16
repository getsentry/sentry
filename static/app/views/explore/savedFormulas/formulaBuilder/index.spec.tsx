import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {SavedFormula} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import FormulaBuilderPage from 'sentry/views/explore/savedFormulas/formulaBuilder';

function SavedFormulaFixture(params: Partial<SavedFormula> = {}): SavedFormula {
  return {
    id: '2',
    name: 'formula.apdex',
    dataset: 'spans',
    description: null,
    formula: '{count_satisfied} / count()',
    params: [{name: 'threshold', order: 0, type: 'number', value: ''}],
    references: [{name: 'count_satisfied', value: 'count_if(`span.duration:<100`)'}],
    type: 'number',
    unit: null,
    prebuilt: false,
    createdBy: null,
    updatedBy: null,
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

  it('allows editing a prebuilt formula', async () => {
    renderEditPage(SavedFormulaFixture({prebuilt: true}));

    expect(await screen.findByRole('textbox', {name: 'Formula name'})).toBeEnabled();
    expect(screen.getByRole('textbox', {name: 'Parameter name'})).toBeEnabled();
    expect(screen.getByRole('textbox', {name: 'Reference name'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
  });

  it('saves suggested values for parameters', async () => {
    const formula = SavedFormulaFixture({
      params: [
        {name: 'duration', order: 0, type: 'column', value: 'span.duration'},
        {name: 'threshold', order: 1, type: 'number', value: '300'},
      ],
    });
    renderEditPage(formula);
    const saveRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/formulas/${formula.id}/`,
      method: 'PUT',
      body: formula,
    });

    const suggestedNumber = await screen.findByRole('textbox', {
      name: 'Suggested value',
    });
    expect(suggestedNumber).toHaveValue('300');
    expect(screen.getByRole('button', {name: 'Suggested value'})).toHaveTextContent(
      'span.duration'
    );

    await userEvent.clear(suggestedNumber);
    await userEvent.type(suggestedNumber, 'abc');
    expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();

    await userEvent.clear(suggestedNumber);
    await userEvent.type(suggestedNumber, '500');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() =>
      expect(saveRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            params: [
              {name: 'duration', order: 0, type: 'column', value: 'span.duration'},
              {name: 'threshold', order: 1, type: 'number', value: '500'},
            ],
          }),
        })
      )
    );
  });
});
