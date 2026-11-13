import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {DiagnosticJson, propertyLabel, PropertyTable} from './diagnosticData';
import {WorkflowEngineArtifacts} from './evaluationArtifacts';

describe('propertyLabel', () => {
  it.each([
    ['constructor', 'Constructor'],
    ['eventId', 'Event ID'],
    ['triggered_action_ids', 'Triggered Action IDs'],
    ['apiJSONUrl', 'API JSON URL'],
    ['', '"" (empty key)'],
  ])('formats %j as %j', (key, label) => {
    expect(propertyLabel(key)).toBe(label);
  });
});

describe('PropertyTable', () => {
  it('keeps false, zero, empty strings, and null visible as separate property values', () => {
    render(
      <PropertyTable
        caption="Evaluation"
        data={{
          eventId: '73dffbccf8cc4c008f14468e6b36172e',
          enabled: false,
          count: 0,
          note: '',
          owner: null,
        }}
        labels={{count: 'Evaluations'}}
      />
    );

    const table = screen.getByRole('table', {name: 'Evaluation'});
    expect(within(table).getByRole('rowheader', {name: 'Event ID'})).toBeInTheDocument();
    expect(
      within(table).getByRole('cell', {name: '73dffbccf8cc4c008f14468e6b36172e'})
    ).toBeInTheDocument();
    expect(
      within(within(table).getByRole('row', {name: 'Enabled false'})).getByRole('cell')
    ).toHaveTextContent(/^false$/);
    expect(
      within(within(table).getByRole('row', {name: 'Evaluations 0'})).getByRole('cell')
    ).toHaveTextContent(/^0$/);
    expect(
      within(within(table).getByRole('row', {name: 'Note "" (empty string)'})).getByRole(
        'cell'
      )
    ).toHaveTextContent('"" (empty string)');
    expect(
      within(within(table).getByRole('row', {name: 'Owner null'})).getByRole('cell')
    ).toHaveTextContent(/^null$/);
  });
});

describe('DiagnosticJson', () => {
  it('copies the complete JSON value including nested false, zero, empty, and null values', async () => {
    const user = userEvent.setup();
    const value = {
      conditions: [{result: false, threshold: 0, description: '', owner: null}],
      unknownProperty: {ids: ['73dffbccf8cc4c008f14468e6b36172e']},
    };
    render(<DiagnosticJson value={value} />);

    await user.click(screen.getByRole('button', {name: 'Copy snippet'}));

    expect(await navigator.clipboard.readText()).toBe(JSON.stringify(value, null, 2));
  });
});

describe('WorkflowEngineArtifacts', () => {
  it('mounts JSON only while expanded and copies every attribute', async () => {
    const user = userEvent.setup();
    const attributes = {
      triggered: false,
      outcome: 0,
      error: '',
      details: {owner: null, unknown: ['complete diagnostic value']},
    };
    render(
      <WorkflowEngineArtifacts
        artifacts={[
          {
            itemId: '501',
            projectId: '3',
            traceId: '73dffbccf8cc4c008f14468e6b36172e',
            timestamp: '2026-11-11T12:00:00Z',
            attributes,
          },
        ]}
      />
    );

    const disclosure = screen.getByRole('button', {name: 'JSON attributes'});
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', {name: 'Copy snippet'})).not.toBeInTheDocument();

    await user.click(disclosure);

    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', {name: 'Copy snippet'}));
    expect(await navigator.clipboard.readText()).toBe(
      JSON.stringify(attributes, null, 2)
    );

    await user.click(disclosure);

    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', {name: 'Copy snippet'})).not.toBeInTheDocument();
  });
});
