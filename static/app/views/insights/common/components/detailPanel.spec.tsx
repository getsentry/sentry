import {render, screen} from 'sentry-test/reactTestingLibrary';

import DetailPanel from 'sentry/views/insights/common/components/detailPanel';

describe('DetailPanel', function () {
  it('renders toolbar and inner content', function () {
    render(<DetailPanel detailKey={'true'}>Content</DetailPanel>);

    expect(screen.getByRole('button', {name: 'Dock to the bottom'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Dock to the right'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Close Details'})).toBeInTheDocument();

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('does not render content when closed', function () {
    render(<DetailPanel detailKey={undefined}>Content</DetailPanel>);

    expect(screen.queryByRole('button', {name: 'Close Details'})).not.toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });
});
