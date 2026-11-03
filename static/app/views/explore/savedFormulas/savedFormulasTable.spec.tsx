import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {SavedFormula} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import {SavedFormulasTable} from 'sentry/views/explore/savedFormulas/savedFormulasTable';

function SavedFormulaFixture(params: Partial<SavedFormula> = {}): SavedFormula {
  return {
    id: '1',
    name: 'formula.apdex',
    dataset: 'spans',
    description: null,
    formula: '{count_satisfied} / count()',
    params: [],
    references: [{name: 'count_satisfied', value: 'count_if(`span.duration:<100`)'}],
    type: 'number',
    unit: null,
    prebuilt: false,
    createdBy: null,
    updatedBy: null,
    ...params,
  };
}

describe('SavedFormulasTable', () => {
  it('shows the creator of a user formula', async () => {
    const user = UserFixture({name: 'Creator'});
    render(
      <SavedFormulasTable
        formulas={[SavedFormulaFixture({createdBy: user, updatedBy: user})]}
        isError={false}
        isPending={false}
        sort={{field: 'name', kind: 'asc'}}
      />
    );

    await userEvent.hover(await screen.findByTestId('letter_avatar-avatar'));
    expect(await screen.findByText('Creator (foo@example.com)')).toBeInTheDocument();
  });

  it('does not show an editor for an unedited prebuilt formula', async () => {
    render(
      <SavedFormulasTable
        formulas={[SavedFormulaFixture({prebuilt: true})]}
        isError={false}
        isPending={false}
        sort={{field: 'name', kind: 'asc'}}
      />
    );

    expect(await screen.findByText('apdex')).toBeInTheDocument();
    expect(screen.queryByTestId('letter_avatar-avatar')).not.toBeInTheDocument();
  });

  it('shows the editor of an edited prebuilt formula', async () => {
    render(
      <SavedFormulasTable
        formulas={[
          SavedFormulaFixture({prebuilt: true, updatedBy: UserFixture({name: 'Editor'})}),
        ]}
        isError={false}
        isPending={false}
        sort={{field: 'name', kind: 'asc'}}
      />
    );

    await userEvent.hover(await screen.findByTestId('letter_avatar-avatar'));
    expect(
      await screen.findByText('Edited by Editor (foo@example.com)')
    ).toBeInTheDocument();
  });
});
