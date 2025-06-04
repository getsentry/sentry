import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {DatabaseSystemSelector} from 'sentry/views/insights/database/components/databaseSystemSelector';
import {SpanMetricsField} from 'sentry/views/insights/types';

jest.mock('sentry/views/insights/common/queries/useDiscover', () => ({
  useSpanMetrics: jest.fn(),
}));

jest.mock('sentry/utils/useLocalStorageState', () => ({
  useLocalStorageState: jest.fn(),
}));

jest.mock('sentry/utils/useLocation', () => ({
  useLocation: jest.fn(),
}));

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const mockUseLocalStorageState = jest.mocked(useLocalStorageState);
const mockUseSpanMetrics = jest.mocked(useSpanMetrics);
const mockUseLocation = jest.mocked(useLocation);
const mockUseNavigate = jest.mocked(useNavigate);

describe('DatabaseSystemSelector', function () {
  const organization = OrganizationFixture();

  afterAll(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockUseLocation.mockReturnValue({
      query: {project: ['1']},
      pathname: '',
      search: '',
      hash: '',
      state: undefined,
      action: 'POP',
      key: '',
    });
  });

  it('is disabled and does not select a system if there are none available', async function () {
    const mockSetState = jest.fn();
    mockUseLocalStorageState.mockReturnValue(['', mockSetState]);
    mockUseSpanMetrics.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);

    render(<DatabaseSystemSelector />, {organization});

    expect(mockSetState).not.toHaveBeenCalled();
    const dropdownButton = await screen.findByRole('button');
    expect(dropdownButton).toBeInTheDocument();
    expect(dropdownButton).toHaveTextContent('SystemNone');
  });

  it('is disabled when only one database system is present and shows that system as selected', async function () {
    const mockSetState = jest.fn();
    mockUseLocalStorageState.mockReturnValue(['', mockSetState]);
    mockUseSpanMetrics.mockReturnValue({
      data: [
        {
          'span.system': 'postgresql',
          'count()': 1000,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);

    render(<DatabaseSystemSelector />, {organization});

    const dropdownSelector = await screen.findByRole('button');
    expect(dropdownSelector).toBeDisabled();
    expect(mockSetState).toHaveBeenCalledWith('postgresql');
  });

  it('renders all database system options correctly', async function () {
    mockUseSpanMetrics.mockReturnValue({
      data: [
        {
          'span.system': 'postgresql',
          'count()': 1000,
        },
        {
          'span.system': 'mongodb',
          'count()': 500,
        },
        {
          'span.system': 'chungusdb',
          'count()': 200,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);

    render(<DatabaseSystemSelector />, {organization});

    const dropdownSelector = await screen.findByRole('button');
    expect(dropdownSelector).toBeEnabled();
    expect(mockUseSpanMetrics).toHaveBeenCalled();

    const dropdownButton = await screen.findByRole('button');
    expect(dropdownButton).toBeInTheDocument();

    await userEvent.click(dropdownButton);

    const dropdownOptionLabels = await screen.findAllByTestId('menu-list-item-label');
    expect(dropdownOptionLabels[0]).toHaveTextContent('PostgreSQL');
    expect(dropdownOptionLabels[1]).toHaveTextContent('MongoDB');
    // chungusdb should not be added as an option
    expect(dropdownOptionLabels).toHaveLength(2);
  });

  it('chooses the currently selected system from localStorage', async function () {
    mockUseLocalStorageState.mockReturnValue(['mongodb', () => {}]);
    mockUseSpanMetrics.mockReturnValue({
      data: [
        {
          'span.system': 'postgresql',
          'count()': 1000,
        },
        {
          'span.system': 'mongodb',
          'count()': 500,
        },
        {
          'span.system': 'chungusdb',
          'count()': 200,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);

    render(<DatabaseSystemSelector />, {organization});

    expect(await screen.findByText('MongoDB')).toBeInTheDocument();
  });

  it('does not set the value from localStorage if the value is invalid', async function () {
    const mockSetState = jest.fn();
    mockUseLocalStorageState.mockReturnValue(['chungusdb', mockSetState]);
    mockUseSpanMetrics.mockReturnValue({
      data: [
        {
          'span.system': 'postgresql',
          'count()': 1000,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);

    render(<DatabaseSystemSelector />, {organization});

    const dropdownSelector = await screen.findByRole('button');
    expect(dropdownSelector).toBeInTheDocument();
    expect(mockSetState).not.toHaveBeenCalledWith('chungusdb');
  });

  it('prioritizes the system set in query parameters but does not replace localStorage value until an option is clicked', async function () {
    const {SPAN_SYSTEM} = SpanMetricsField;
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    mockUseLocation.mockReturnValue({
      query: {project: ['1'], [SPAN_SYSTEM]: 'mongodb'},
      pathname: '',
      search: '',
      hash: '',
      state: undefined,
      action: 'POP',
      key: '',
    });

    mockUseSpanMetrics.mockReturnValue({
      data: [
        {
          'span.system': 'postgresql',
          'count()': 1000,
        },
        {
          'span.system': 'mongodb',
          'count()': 500,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);

    const mockSetState = jest.fn();
    mockUseLocalStorageState.mockReturnValue(['postgresql', mockSetState]);

    render(<DatabaseSystemSelector />, {organization});

    const dropdownSelector = await screen.findByRole('button');
    expect(dropdownSelector).toHaveTextContent('SystemMongoDB');
    expect(mockSetState).not.toHaveBeenCalledWith('mongodb');

    // Now that it has been confirmed that following a URL does not reset localStorage state, confirm that
    // clicking a different option will update both the state and the URL
    await userEvent.click(dropdownSelector);
    const dropdownOptionLabels = await screen.findAllByTestId('menu-list-item-label');
    expect(dropdownOptionLabels[0]).toHaveTextContent('PostgreSQL');
    expect(dropdownOptionLabels[1]).toHaveTextContent('MongoDB');

    await userEvent.click(dropdownOptionLabels[0]!);
    expect(dropdownSelector).toHaveTextContent('SystemPostgreSQL');
    expect(mockSetState).toHaveBeenCalledWith('postgresql');
    expect(mockNavigate).toHaveBeenCalledWith({
      action: 'POP',
      hash: '',
      key: '',
      pathname: '',
      query: {project: ['1'], 'span.system': 'postgresql'},
      search: '',
      state: undefined,
    });
  });
});
