import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  MemoryInputTab,
  MemoryOutputTab,
} from 'sentry/views/explore/conversations/components/memorySpanTabs';
import {
  type Memory,
  MemoryOperation,
} from 'sentry/views/insights/pages/agents/utils/memory';

function memoryFixture(overrides: Partial<Memory> = {}): Memory {
  return {
    operation: MemoryOperation.CREATE,
    query: undefined,
    rawRecords: undefined,
    recordCount: undefined,
    recordId: undefined,
    records: null,
    storeId: undefined,
    ...overrides,
  };
}

describe('MemoryInputTab', () => {
  it.each([
    [MemoryOperation.CREATE_STORE, 'No input for this span'],
    [MemoryOperation.SEARCH, 'The search query was not captured'],
    [MemoryOperation.CREATE, 'No records to display'],
  ])('renders the empty state for %s without a period', (operation, message) => {
    render(<MemoryInputTab memory={memoryFixture({operation})} />);

    expect(screen.getByText(message, {exact: true})).toBeInTheDocument();
  });

  it('distinguishes uncaptured records from absent records', () => {
    render(<MemoryInputTab memory={memoryFixture({recordCount: 2})} />);

    expect(screen.getByText('Record content was not captured')).toBeInTheDocument();
  });

  it('renders record text and structured content with the shared helper', () => {
    render(
      <MemoryInputTab
        memory={memoryFixture({
          records: [
            {content: 'Remember this preference'},
            {content: {preference: 'concise answers'}},
          ],
        })}
      />
    );

    expect(screen.getByText('Remember this preference')).toBeInTheDocument();
    expect(screen.getByText('preference')).toBeInTheDocument();
    expect(screen.getByText('"concise answers"')).toBeInTheDocument();
  });
});

describe('MemoryOutputTab', () => {
  it.each([
    [MemoryOperation.CREATE_STORE, 'No output for this span'],
    [MemoryOperation.SEARCH, 'No matching records were returned'],
  ])('renders the empty state for %s without a period', (operation, message) => {
    render(<MemoryOutputTab memory={memoryFixture({operation})} />);

    expect(screen.getByText(message, {exact: true})).toBeInTheDocument();
  });
});
