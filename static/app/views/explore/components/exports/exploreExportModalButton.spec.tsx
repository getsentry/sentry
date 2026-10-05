import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ExportQueryType} from 'sentry/components/exports/useDataExport';
import {ExploreExportModalButton} from 'sentry/views/explore/components/exports/exploreExportModalButton';
import type {ExploreExportConfig} from 'sentry/views/explore/components/exports/types';
import {TraceItemDataset} from 'sentry/views/explore/types';

const organization = OrganizationFixture({features: ['discover-query']});

function makeConfig(): ExploreExportConfig {
  return {
    title: 'Test Export',
    filenameBase: 'test',
    queryInfo: {
      dataset: TraceItemDataset.LOGS,
      field: ['message'],
      project: [1],
      query: '',
      sort: [],
    },
    asyncQueryType: ExportQueryType.EXPLORE,
    supportsAllColumns: true,
    availableFormats: ['csv', 'jsonl'],
    estimatedRowCount: 1500,
    localRowCount: 1000,
    localDownload: jest.fn(),
    trackExportSubmit: jest.fn(),
  };
}

function ExampleExploreExportModalButton(
  props: Partial<React.ComponentProps<typeof ExploreExportModalButton>>
) {
  return (
    <ExploreExportModalButton
      config={makeConfig()}
      isDataEmpty={false}
      isDataError={false}
      isDataLoading={false}
      onOpen={jest.fn()}
      onClose={jest.fn()}
      {...props}
    />
  );
}

describe('ExploreExportModalButton', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('opens the modal and fires onOpen when clicked', async () => {
    const onOpen = jest.fn();
    render(<ExampleExploreExportModalButton onOpen={onOpen} />, {organization});
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalled();
  });

  it('fires onClose with escape_key when closed via Escape', async () => {
    const onClose = jest.fn();
    render(<ExampleExploreExportModalButton onClose={onClose} />, {organization});
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Export'}));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('escape_key');
    });
  });

  it('fires onClose once with cancel_button when the Cancel button is clicked', async () => {
    const onClose = jest.fn();
    render(<ExampleExploreExportModalButton onClose={onClose} />, {organization});
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Export'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Cancel'}));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('cancel_button');
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables the button with a tooltip when data is empty', async () => {
    render(<ExampleExploreExportModalButton isDataEmpty />, {organization});
    renderGlobalModal();

    const button = screen.getByRole('button', {name: 'Export'});
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.hover(button);
    expect(await screen.findByText('No data to export')).toBeInTheDocument();
  });
});
