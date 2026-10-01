import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SnapshotStatusBadge} from 'sentry/components/preprod/snapshotStatusBadge';

describe('SnapshotStatusBadge', () => {
  it('shows Failed when a failed comparison is not approved', () => {
    render(
      <SnapshotStatusBadge
        comparisonState="failed"
        approvalStatus={null}
        errorMessage={null}
      />
    );
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows Approved when a failed comparison was approved', () => {
    render(
      <SnapshotStatusBadge
        comparisonState="failed"
        approvalStatus="approved"
        errorMessage={null}
      />
    );
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });

  it('shows Approved when a no-base build was approved', () => {
    render(
      <SnapshotStatusBadge
        comparisonState="no_base_build"
        approvalStatus="approved"
        errorMessage={null}
      />
    );
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByText('No base build')).not.toBeInTheDocument();
  });

  it('keeps No base build when not approved', () => {
    render(
      <SnapshotStatusBadge
        comparisonState="no_base_build"
        approvalStatus={null}
        errorMessage={null}
      />
    );
    expect(screen.getByText('No base build')).toBeInTheDocument();
  });
});
