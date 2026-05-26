import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategoryExact} from 'sentry/types/core';

import {PlanMigrationRow} from 'getsentry/views/subscriptionPage/planMigrationActive/planMigrationRow';

function renderRow(props: React.ComponentProps<typeof PlanMigrationRow>) {
  return render(
    <table>
      <tbody>
        <PlanMigrationRow {...props} />
      </tbody>
    </table>
  );
}

describe('PlanMigrationRow', () => {
  it.each([
    ['attachment', DataCategoryExact.ATTACHMENT, 'attachments'],
    ['log_byte', DataCategoryExact.LOG_BYTE, 'logBytes'],
    ['trace_metric_byte', DataCategoryExact.TRACE_METRIC_BYTE, 'traceMetricBytes'],
  ])(
    'renders byte category %s with GB suffix and no appended display name',
    (_label, category, testIdSuffix) => {
      renderRow({type: category, currentValue: 10, nextValue: 20});

      const currentCell = screen.getByTestId(`current-${testIdSuffix}`);
      const newCell = screen.getByTestId(`new-${testIdSuffix}`);

      expect(currentCell).toHaveTextContent(/GB$/);
      expect(newCell).toHaveTextContent(/GB$/);
    }
  );

  it('renders PROFILE_DURATION with hours suffix', () => {
    renderRow({
      type: DataCategoryExact.PROFILE_DURATION,
      currentValue: 1,
      nextValue: 5,
    });

    const currentCell = screen.getByTestId('current-profileDuration');
    const newCell = screen.getByTestId('new-profileDuration');

    expect(currentCell).toHaveTextContent(/hour$/);
    expect(newCell).toHaveTextContent(/hours$/);
  });

  it('renders count category with display name', () => {
    renderRow({
      type: DataCategoryExact.ERROR,
      currentValue: 50000,
      nextValue: 100000,
    });

    const currentCell = screen.getByTestId('current-errors');
    const newCell = screen.getByTestId('new-errors');

    expect(currentCell).not.toHaveTextContent(/GB/);
    expect(newCell).not.toHaveTextContent(/GB/);
    expect(currentCell).toHaveTextContent(/errors?$/i);
    expect(newCell).toHaveTextContent(/errors?$/i);
  });
});
