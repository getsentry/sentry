import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DisplayType} from 'sentry/views/dashboards/types';
import {DataSetStep} from 'sentry/views/dashboards/widgetBuilder/buildSteps/dataSetStep';
import {DataSet} from 'sentry/views/dashboards/widgetBuilder/utils';

describe('DataSetStep', () => {
  it('renders the spans dataset with the EAP feature flag', () => {
    render(
      <DataSetStep
        dataSet={DataSet.ISSUES}
        displayType={DisplayType.TABLE}
        onChange={jest.fn()}
      />,
      {
        organization: OrganizationFixture({
          features: ['dashboards-eap'],
        }),
      }
    );

    expect(screen.getByText('Spans')).toBeInTheDocument();
  });
});
