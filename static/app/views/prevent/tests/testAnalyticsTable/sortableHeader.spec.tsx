import {render, screen} from 'sentry-test/reactTestingLibrary';

import SortableHeader from './sortableHeader';

const mockLocation = {
  pathname: '/prevent/tests/',
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

describe('SortableHeader', () => {
  const defaultProps = {
    fieldName: 'averageDurationMs',
    label: 'Avg. Duration',
    alignment: 'right',
    enableToggle: false,
    sort: undefined,
  };

  const renderHeader = (props = {}) => {
    return render(<SortableHeader {...defaultProps} {...props} />);
  };

  beforeEach(() => {
    mockLocation.query = {};
  });

  describe('sortable fields', () => {
    it('renders with correct label and as clickable link', () => {
      renderHeader({fieldName: 'flakeRate', label: 'Flake Rate'});

      const link = screen.getByRole('columnheader');
      expect(link).toBeInTheDocument();
      expect(link.tagName).toBe('A');
      expect(screen.getByText('Flake Rate')).toBeInTheDocument();
    });

    it('shows no sort arrow when not sorted', () => {
      renderHeader({fieldName: 'flakeRate', sort: undefined});

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none');
    });

    it('shows ascending arrow when sorted ascending', () => {
      renderHeader({
        fieldName: 'totalFailCount',
        sort: {field: 'totalFailCount', kind: 'asc'},
      });

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending');
    });

    it('shows descending arrow when sorted descending', () => {
      renderHeader({
        fieldName: 'lastRun',
        sort: {field: 'lastRun', kind: 'desc'},
      });

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
    });

    it('generates correct link for first click (no sort → descending)', () => {
      renderHeader({fieldName: 'flakeRate'});

      const link = screen.getByRole('columnheader');
      expect(link).toHaveAttribute('href', '/prevent/tests/?sort=-flakeRate');
    });

    it('generates correct link for second click (descending → ascending)', () => {
      renderHeader({
        fieldName: 'flakeRate',
        sort: {field: 'flakeRate', kind: 'desc'},
      });

      const link = screen.getByRole('columnheader');
      expect(link).toHaveAttribute('href', '/prevent/tests/?sort=flakeRate');
    });
  });

  describe('non-sortable fields', () => {
    it('renders as plain text without link functionality', () => {
      renderHeader({
        fieldName: 'testName',
        label: 'Test Name',
      });

      const header = screen.getByRole('columnheader');
      expect(header).toBeInTheDocument();
      expect(header.tagName).toBe('SPAN');
      expect(header).not.toHaveAttribute('href');
      expect(screen.getByText('Test Name')).toBeInTheDocument();
    });
  });

  describe('query parameter handling', () => {
    it('preserves other query parameters when changing sort', () => {
      mockLocation.query = {
        cursor: 'abc123',
        integratedOrgId: 'org-123',
        repository: 'test-repo',
        branch: 'main',
      };

      renderHeader({fieldName: 'flakeRate'});

      const link = screen.getByRole('columnheader');
      const href = link.getAttribute('href');
      expect(href).toContain('integratedOrgId=org-123');
      expect(href).toContain('repository=test-repo');
      expect(href).toContain('branch=main');
      expect(href).toContain('sort=-flakeRate');
    });

    it('removes cursor and navigation params when sorting', () => {
      mockLocation.query = {
        cursor: 'abc123',
        navigation: 'next',
        integratedOrgId: 'org-123',
        sort: '-flakeRate',
      };

      renderHeader({
        fieldName: 'flakeRate',
        sort: {field: 'flakeRate', kind: 'desc'},
      });

      const link = screen.getByRole('columnheader');
      const href = link.getAttribute('href');
      expect(href).not.toContain('cursor');
      expect(href).not.toContain('navigation');
      expect(href).toContain('integratedOrgId=org-123');
    });
  });
});
