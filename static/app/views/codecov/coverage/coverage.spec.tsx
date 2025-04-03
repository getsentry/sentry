import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import CoveragePage from 'sentry/views/pipeline/coverage/coverage';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CoveragePage', () => {
  it('renders the placeholder content', () => {
    render(<CoveragePage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    const testContent = screen.getByText('Coverage Analytics');
    expect(testContent).toBeInTheDocument();
  });
});
