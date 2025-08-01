import {ProcessedInsightFixture} from 'sentry-fixture/preProdAppSize';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AppSizeInsightsSidebarRow} from './appSizeInsightsSidebarRow';

describe('AppSizeInsightsSidebarRow', () => {
  const getDefaultProps = () => ({
    insight: ProcessedInsightFixture(),
    isExpanded: false,
    onToggleExpanded: jest.fn(),
  });

  it('renders insight name and savings information', () => {
    render(<AppSizeInsightsSidebarRow {...getDefaultProps()} />);

    expect(screen.getByText('Duplicate files')).toBeInTheDocument();
    expect(
      screen.getByText('You have files that are duplicated across your app')
    ).toBeInTheDocument();
    expect(screen.getByText('Potential savings 1.02 MB')).toBeInTheDocument();
    expect(screen.getByText('15.5%')).toBeInTheDocument();
  });

  it('shows file count button', () => {
    render(<AppSizeInsightsSidebarRow {...getDefaultProps()} />);

    expect(screen.getByText('3 files')).toBeInTheDocument();
  });

  it('does not show files when collapsed', () => {
    render(<AppSizeInsightsSidebarRow {...getDefaultProps()} />);

    expect(screen.queryByText('src/components/Button.js')).not.toBeInTheDocument();
    expect(screen.queryByText('src/components/Icon.js')).not.toBeInTheDocument();
  });

  it('shows files when expanded', () => {
    render(<AppSizeInsightsSidebarRow {...getDefaultProps()} isExpanded />);

    expect(screen.getByText('src/components/Button.js')).toBeInTheDocument();
    expect(screen.getByText('src/components/Icon.js')).toBeInTheDocument();
    expect(screen.getByText('src/assets/logo.png')).toBeInTheDocument();

    // Check file savings are displayed with negative values
    expect(screen.getByText(/-\s*512\s*KB/i)).toBeInTheDocument();
    // Two files have 256 KB savings, so we expect 2 matches
    expect(screen.getAllByText(/-\s*256\s*KB/i)).toHaveLength(2);
    expect(screen.getByText('(-7.5%)')).toBeInTheDocument();
    // Two files have (-4%) savings, so we expect 2 matches
    expect(screen.getAllByText('(-4%)')).toHaveLength(2);
  });

  it('calls onToggleExpanded when clicking the toggle button', async () => {
    const props = getDefaultProps();
    render(<AppSizeInsightsSidebarRow {...props} />);

    const toggleButton = screen.getByRole('button', {name: /3 files/i});
    await userEvent.click(toggleButton);

    expect(props.onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it('handles optimizable image files', () => {
    render(<AppSizeInsightsSidebarRow {...getDefaultProps()} isExpanded />);
    expect(screen.getByText('src/assets/logo.png')).toBeInTheDocument();
  });

  it('renders with no files', () => {
    const insightWithNoFiles = ProcessedInsightFixture({
      files: [],
    });

    render(
      <AppSizeInsightsSidebarRow
        {...getDefaultProps()}
        insight={insightWithNoFiles}
        isExpanded
      />
    );

    expect(screen.getByText('0 files')).toBeInTheDocument();
    expect(screen.queryByText(/^src\//)).not.toBeInTheDocument();
  });

  it('formats large file sizes correctly', () => {
    const insightWithLargeFiles = ProcessedInsightFixture({
      totalSavings: 5242880000, // 5 GB
      files: [
        {
          path: 'large-file.js',
          savings: 2147483648, // 2 GB
          percentage: 40,
          data: {
            fileType: 'regular' as const,
            originalFile: {
              file_path: 'large-file.js',
              total_savings: 2147483648,
            },
          },
        },
      ],
    });

    render(
      <AppSizeInsightsSidebarRow
        {...getDefaultProps()}
        insight={insightWithLargeFiles}
        isExpanded
      />
    );

    expect(screen.getByText('Potential savings 5.24 GB')).toBeInTheDocument();
    expect(screen.getByText(/-2\.15\s*GB/i)).toBeInTheDocument();
  });
});
