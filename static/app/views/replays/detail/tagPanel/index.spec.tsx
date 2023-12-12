import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayReader from 'sentry/utils/replays/replayReader';
import TagPanel from 'sentry/views/replays/detail/tagPanel';

const mockReplay = ReplayReader.factory(
  {
    replayRecord: ReplayRecordFixture({
      browser: {
        name: 'Chrome',
        version: '110.0.0',
      },
      tags: {
        foo: ['bar', 'baz'],
        'my custom tag': ['a wordy value'],
      },
    }),
    errors: [],
    attachments: [],
  },
  {}
);

const renderComponent = (replay: ReplayReader | null) => {
  return render(
    <ReplayContextProvider isFetching={false} replay={replay}>
      <TagPanel />
    </ReplayContextProvider>
  );
};

describe('TagPanel', () => {
  it("should show a placeholder if there's no replay record", () => {
    renderComponent(null);

    expect(screen.getByTestId('replay-tags-loading-placeholder')).toBeInTheDocument();
  });

  it('should snapshot empty state', () => {
    renderComponent(null);
  });

  it('should show the tags correctly inside ReplayTagsTableRow component with single item array', () => {
    renderComponent(mockReplay);

    expect(screen.getByText('browser.name')).toBeInTheDocument();
    expect(screen.getByText('Chrome')).toBeInTheDocument();
  });

  it('should show the tags correctly inside ReplayTagsTableRow component with multiple items array', () => {
    renderComponent(mockReplay);

    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    expect(screen.getByText('baz')).toBeInTheDocument();
  });

  it('should link known tags to their proper field names', () => {
    renderComponent(mockReplay);

    expect(screen.getByText('bar').closest('a')).toHaveAttribute(
      'href',
      '/organizations/org-slug/replays/?query=tags%5B%22foo%22%5D%3A%22bar%22'
    );
    expect(screen.getByText('baz').closest('a')).toHaveAttribute(
      'href',
      '/organizations/org-slug/replays/?query=tags%5B%22foo%22%5D%3A%22baz%22'
    );
  });

  it('should link user-submitted tags with the tags[] syntax', () => {
    renderComponent(mockReplay);

    expect(screen.getByText('a wordy value').closest('a')).toHaveAttribute(
      'href',
      '/organizations/org-slug/replays/?query=tags%5B%22my%20custom%20tag%22%5D%3A%22a%20wordy%20value%22'
    );
  });

  it('should snapshot state with tags', () => {
    renderComponent(mockReplay);
  });

  it('should show not found message when no tags are found', () => {
    mockReplay!.getReplay = jest.fn().mockReturnValue({tags: {}});

    renderComponent(mockReplay);

    expect(screen.getByText('No tags for this replay were found.')).toBeInTheDocument();
  });
});
