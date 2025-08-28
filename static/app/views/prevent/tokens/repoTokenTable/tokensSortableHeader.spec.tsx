import {render, screen} from 'sentry-test/reactTestingLibrary';

import TokensSortableHeader from './tokensSortableHeader';

const mockLocation = {
  pathname: '/prevent/tokens/',
  query: {},
  search: '',
  hash: '',
  state: undefined,
  action: 'POP' as const,
  key: 'test',
};

jest.mock('sentry/utils/useLocation', () => ({
  useLocation: () => mockLocation,
}));

describe('TokensSortableHeader', () => {
  const defaultProps = {
    fieldName: 'name',
    label: 'Repository Name',
    alignment: 'left',
    sort: undefined,
  };

  const renderHeader = (props = {}) => {
    return render(<TokensSortableHeader {...defaultProps} {...props} />);
  };

  beforeEach(() => {
    // Reset mock location before each test
    mockLocation.query = {};
  });

  it('renders with correct label', () => {
    renderHeader();
    expect(screen.getByRole('columnheader')).toBeInTheDocument();
    expect(screen.getByText('Repository Name')).toBeInTheDocument();
  });

  it('shows no sort arrow when not sorted', () => {
    renderHeader({sort: undefined});
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none');
  });

  it('shows ascending arrow when sorted ascending', () => {
    renderHeader({
      sort: {field: 'name', kind: 'asc'},
    });
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('shows descending arrow when sorted descending', () => {
    renderHeader({
      sort: {field: 'name', kind: 'desc'},
    });
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
  });

  it('generates correct link for first click (no sort → ascending)', () => {
    renderHeader();
    const link = screen.getByRole('columnheader');
    expect(link).toHaveAttribute('href', '/prevent/tokens/?sort=name');
  });

  it('generates correct link for second click (ascending → descending)', () => {
    renderHeader({
      sort: {field: 'name', kind: 'asc'},
    });
    const link = screen.getByRole('columnheader');
    expect(link).toHaveAttribute('href', '/prevent/tokens/?sort=-name');
  });

  it('generates correct link for third click (descending → no sort)', () => {
    renderHeader({
      sort: {field: 'name', kind: 'desc'},
    });
    const link = screen.getByRole('columnheader');
    expect(link).toHaveAttribute('href', '/prevent/tokens/');
  });

  it('preserves other query parameters when changing sort', () => {
    mockLocation.query = {
      cursor: 'abc123',
      integratedOrgId: 'org-123',
      someOtherParam: 'value',
    };

    renderHeader();
    const link = screen.getByRole('columnheader');
    expect(link).toHaveAttribute(
      'href',
      '/prevent/tokens/?integratedOrgId=org-123&someOtherParam=value&sort=name'
    );
  });

  it('removes cursor and navigation params when sorting', () => {
    mockLocation.query = {
      cursor: 'abc123',
      navigation: 'next',
      integratedOrgId: 'org-123',
      sort: '-name',
    };

    renderHeader({
      sort: {field: 'name', kind: 'desc'},
    });

    const link = screen.getByRole('columnheader');
    expect(link.getAttribute('href')).not.toContain('cursor');
    expect(link.getAttribute('href')).not.toContain('navigation');
    expect(link).toHaveAttribute('href', '/prevent/tokens/?integratedOrgId=org-123');
  });
});
