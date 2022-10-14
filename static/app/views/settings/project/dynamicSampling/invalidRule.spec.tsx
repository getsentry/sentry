import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';

import {InvalidRule} from './invalidRule';

export const samplingBreakdownTitle = 'Transaction Breakdown';

describe('Dynamic Sampling - Invalid Rule', function () {
  beforeEach(function () {
    ServerSideSamplingStore.reset();
  });

  it('renders', async function () {
    render(
      <InvalidRule
        rule={TestStubs.DynamicSamplingConfig().specificRule}
        loadingRecommendedSdkUpgrades={false}
        noPermission={false}
        onDeleteRule={jest.fn()}
        onEditRule={jest.fn()}
      />
    );

    expect(screen.getByTestId('icon-warning')).toBeInTheDocument();

    userEvent.hover(screen.getByTestId('icon-warning'));

    expect(
      await screen.findByText(
        "It looks like the uniform rule's sample rate has been updated and is now higher than this rule's sample rate, so this rule is no longer valid."
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('checkbox', {name: 'Activate Rule'})).not.toBeChecked();

    userEvent.click(screen.getByRole('checkbox', {name: 'Activate Rule'}));

    expect(
      await screen.findByText(
        'To enable this rule, its sample rate must be updated with a value greater than the uniform rule (Else) sample rate.'
      )
    ).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', {name: 'Actions'}));

    expect(screen.getByRole('menuitemradio', {name: 'Edit'})).toBeEnabled();

    expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toBeEnabled();
  });

  it('does not render toggle', function () {
    render(
      <InvalidRule
        rule={TestStubs.DynamicSamplingConfig().specificRule}
        loadingRecommendedSdkUpgrades
        noPermission={false}
        onDeleteRule={jest.fn()}
        onEditRule={jest.fn()}
      />
    );

    expect(
      screen.queryByRole('checkbox', {name: 'Activate Rule'})
    ).not.toBeInTheDocument();
  });

  it('does not let users edit and delete', function () {
    render(
      <InvalidRule
        rule={TestStubs.DynamicSamplingConfig().specificRule}
        loadingRecommendedSdkUpgrades={false}
        onDeleteRule={jest.fn()}
        onEditRule={jest.fn()}
        noPermission
      />
    );

    userEvent.click(screen.getByRole('button', {name: 'Actions'}));

    expect(screen.getByRole('menuitemradio', {name: 'Edit'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
