import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {SamplingRuleOperator} from 'sentry/types/sampling';

import {Rule} from './rule';

export const samplingBreakdownTitle = 'Transaction Breakdown';

describe('Dynamic Sampling - Rule', function () {
  beforeEach(function () {
    ServerSideSamplingStore.reset();
  });

  it('renders toggle placeholders', function () {
    render(
      <Rule
        operator={SamplingRuleOperator.IF}
        hideGrabButton={false}
        rule={TestStubs.DynamicSamplingConfig().uniformRule}
        onEditRule={() => {}}
        onDeleteRule={() => {}}
        onActivate={() => {}}
        noPermission={false}
        upgradeSdkForProjects={[]}
        listeners={undefined}
        dragging={false}
        sorting={false}
        loadingRecommendedSdkUpgrades
        valid
      />
    );

    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
    expect(screen.queryByLabelText('Activate Rule')).not.toBeInTheDocument();
  });

  it('can be deactivated even with unsupported SDKs', function () {
    ServerSideSamplingStore.sdkVersionsRequestSuccess([
      {
        project: 'javascript',
        latestSDKVersion: '1.0.3',
        latestSDKName: 'sentry.javascript.react',
        isSendingSampleRate: true,
        isSendingSource: true,
        isSupportedPlatform: false,
      },
    ]);

    render(
      <Rule
        operator={SamplingRuleOperator.IF}
        hideGrabButton={false}
        rule={TestStubs.DynamicSamplingConfig().uniformRule}
        onEditRule={() => {}}
        onDeleteRule={() => {}}
        onActivate={() => {}}
        noPermission={false}
        upgradeSdkForProjects={['javascript']}
        listeners={undefined}
        dragging={false}
        sorting={false}
        loadingRecommendedSdkUpgrades={false}
        valid
      />
    );

    expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Deactivate Rule')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Deactivate Rule'})).toBeEnabled();
  });

  it('renders invalid rule', async function () {
    render(
      <Rule
        operator={SamplingRuleOperator.IF}
        hideGrabButton={false}
        rule={{...TestStubs.DynamicSamplingConfig().specificRule, active: false}}
        onEditRule={() => {}}
        onDeleteRule={() => {}}
        onActivate={() => {}}
        noPermission={false}
        upgradeSdkForProjects={['javascript']}
        listeners={undefined}
        dragging={false}
        sorting={false}
        loadingRecommendedSdkUpgrades={false}
        valid={false}
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
});
