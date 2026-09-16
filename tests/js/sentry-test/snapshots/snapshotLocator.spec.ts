import {formatSnapshotLocator, snapshotLocator} from './snapshotLocator';

describe('snapshotLocator', () => {
  it('creates serializable locator descriptors', () => {
    const target = snapshotLocator.role('button', 'Save', {exact: true});

    expect(JSON.parse(JSON.stringify(target))).toEqual({
      type: 'role',
      role: 'button',
      name: 'Save',
      exact: true,
    });
  });

  it.each([
    [
      snapshotLocator.role('button', 'Save'),
      'role("button", {name: "Save", exact: true})',
    ],
    [snapshotLocator.label('Email', {exact: true}), 'label("Email", {exact: true})'],
    [snapshotLocator.text('Welcome'), 'text("Welcome", {exact: true})'],
    [snapshotLocator.testId('save-button'), 'testId("save-button")'],
    [snapshotLocator.css('[data-custom="value"]'), 'css("[data-custom=\\"value\\"]")'],
  ] as const)('formats %j canonically', (target, expected) => {
    expect(formatSnapshotLocator(target)).toBe(expected);
  });
});
