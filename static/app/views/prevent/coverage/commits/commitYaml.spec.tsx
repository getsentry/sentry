import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import CommitYamlPage from 'sentry/views/prevent/coverage/commits/commitYaml';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CommitYamlPage', () => {
  it('renders the passed children', () => {
    render(<CommitYamlPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    const testContent = screen.getByText('Commit YAML Page');
    expect(testContent).toBeInTheDocument();
  });
});
