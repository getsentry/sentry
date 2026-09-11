import {LogFixture} from 'sentry-fixture/log';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

import {LogEmbedStory} from './logEmbedStory';

jest.mock('sentry/components/seer/markdown', () => ({
  SeerMarkdown: ({raw}: {raw: string}) => <div aria-label="Rendered markdown">{raw}</div>,
}));

const TIMESTAMP_MS = Date.UTC(2026, 7, 28, 16, 37, 12);

function createLog(id: string, overrides: Record<string, string> = {}) {
  return LogFixture({
    [OurLogKnownFieldKey.ID]: id,
    [OurLogKnownFieldKey.PROJECT_ID]: '2',
    [OurLogKnownFieldKey.ORGANIZATION_ID]: 3,
    [OurLogKnownFieldKey.TRACE_ID]: 'a1b2c3d4e5f678901234567890abcdef',
    [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: String(
      BigInt(TIMESTAMP_MS) * 1_000_000n
    ) as unknown as string,
    ...overrides,
  });
}

describe('LogEmbedStory', () => {
  it('renders every view of a recent log that carries a trace and project', async () => {
    const untraced = createLog('019bfe1c-0000-7e3d-9a2f-000000000000', {
      [OurLogKnownFieldKey.TRACE_ID]: '',
    });
    const log = createLog('019bfe1c-4c1f-7e3d-9a2f-3e6b1a2c3d4e');
    const eventsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [untraced, log], meta: {}},
      match: [
        MockApiClient.matchQuery({
          dataset: 'ourlogs',
          sort: '-timestamp',
          statsPeriod: '7d',
          per_page: 25,
        }),
      ],
    });

    render(<LogEmbedStory />);

    const variants = await screen.findAllByLabelText('Rendered markdown');
    expect(variants).toHaveLength(4);
    expect(eventsRequest).toHaveBeenCalled();

    const [summary, attributes, attribute, idOnly] = variants as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];

    // The traceless row is skipped in favour of the one the details lookup can use.
    for (const variant of variants) {
      expect(variant).toHaveTextContent(log[OurLogKnownFieldKey.ID]);
      expect(variant).not.toHaveTextContent(untraced[OurLogKnownFieldKey.ID]);
    }

    expect(summary).toHaveTextContent(log[OurLogKnownFieldKey.TRACE_ID]);
    expect(summary).toHaveTextContent(new Date(TIMESTAMP_MS).toISOString());
    expect(summary).not.toHaveTextContent('"view"');

    expect(attributes).toHaveTextContent('"view":"attributes"');
    expect(attribute).toHaveTextContent('"view":"attribute","attribute":"severity"');

    // The id-only variant exercises the embed resolving trace and project itself.
    expect(idOnly).not.toHaveTextContent(log[OurLogKnownFieldKey.TRACE_ID]);
  });

  it('explains itself when the organization has no logs', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [], meta: {}},
    });

    render(<LogEmbedStory />);

    expect(
      await screen.findByText('No log is available for this organization.')
    ).toBeInTheDocument();
  });
});
