import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {DatabaseSystemSelector} from 'sentry/views/insights/database/components/databaseSystemSelector';

jest.mock('sentry/views/insights/common/queries/useDiscover', () => ({
  useSpanMetrics: jest.fn(),
}));

jest.mock('sentry/utils/useLocalStorageState', () => ({
  useLocalStorageState: jest.fn(),
}));

const mockUseLocalStorageState = jest.mocked(useLocalStorageState);
const mockUseSpanMetrics = jest.mocked(useSpanMetrics);

describe('DatabaseSystemSelector', function () {
  const organization = OrganizationFixture();

  afterAll(() => {
    jest.clearAllMocks();
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
    expect(dropdownButton).toHaveTextContent('DB SystemNone');
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
    // chungusdb does not exist, so we do not expect this option to have casing
    expect(dropdownOptionLabels[2]).toHaveTextContent('chungusdb');
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
});
