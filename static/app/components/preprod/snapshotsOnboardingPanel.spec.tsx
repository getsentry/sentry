import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SnapshotsOnboardingPanel} from 'sentry/components/preprod/snapshotsOnboardingPanel';

describe('SnapshotsOnboardingPanel', () => {
  it('fills in the project slug in the upload command', () => {
    render(<SnapshotsOnboardingPanel projectSlug="web-app" />);

    expect(screen.getByText(/--project web-app/)).toBeInTheDocument();
  });

  it('uses a placeholder when the project slug is unknown', () => {
    render(<SnapshotsOnboardingPanel />);

    expect(screen.getByText(/--project <project-slug>/)).toBeInTheDocument();
  });
});
