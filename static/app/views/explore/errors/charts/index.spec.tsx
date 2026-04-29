import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ErrorsCharts} from './index';

describe('ErrorsCharts', () => {
  it('renders the count(errors) chart title', async () => {
    render(<ErrorsCharts />, {
      organization: OrganizationFixture(),
    });

    expect(await screen.findByText('count(errors)')).toBeInTheDocument();
  });

  it('renders the interval selector', async () => {
    render(<ErrorsCharts />, {
      organization: OrganizationFixture(),
    });

    expect(await screen.findByRole('button', {name: 'Interval'})).toBeInTheDocument();
  });

  it('renders the chart type selector', async () => {
    render(<ErrorsCharts />, {
      organization: OrganizationFixture(),
    });

    expect(await screen.findByRole('button', {name: 'Chart type'})).toBeInTheDocument();
  });

  it('renders the context menu', async () => {
    render(<ErrorsCharts />, {
      organization: OrganizationFixture(),
    });

    expect(await screen.findByRole('button', {name: 'Context Menu'})).toBeInTheDocument();
  });
});
