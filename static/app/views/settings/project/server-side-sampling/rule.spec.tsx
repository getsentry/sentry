import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SamplingRuleOperator} from 'sentry/types/sampling';

import {Rule} from './rule';
import {uniformRule} from './testUtils';

export const samplingBreakdownTitle = 'Transaction Breakdown';

describe('Server-Side Sampling - Rule', function () {
  it('renders toggle placeholders', function () {
    render(
      <Rule
        operator={SamplingRuleOperator.IF}
        hideGrabButton={false}
        rule={uniformRule}
        onEditRule={() => {}}
        onDeleteRule={() => {}}
        onActivate={() => {}}
        noPermission={false}
        upgradeSdkForProjects={[]}
        listeners={undefined}
        dragging={false}
        sorting={false}
        loadingRecommendedSdkUpgrades
      />
    );

    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
    expect(screen.queryByLabelText('Activate Rule')).not.toBeInTheDocument();
  });

  it('can be deactivated even with unsupported SDKs', function () {
    render(
      <Rule
        operator={SamplingRuleOperator.IF}
        hideGrabButton={false}
        rule={{...uniformRule, active: true}}
        onEditRule={() => {}}
        onDeleteRule={() => {}}
        onActivate={() => {}}
        noPermission={false}
        upgradeSdkForProjects={['javascript']}
        listeners={undefined}
        dragging={false}
        sorting={false}
        loadingRecommendedSdkUpgrades={false}
      />
    );

    expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Deactivate Rule')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Deactivate Rule'})).toBeEnabled();
  });
});
