import {Event as EventFixture} from 'sentry-fixture/event';
import {Organization} from 'sentry-fixture/organization';
import {Release as ReleaseFixture} from 'sentry-fixture/release';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {ReleaseStatus} from 'sentry/types';
import {EventOrGroupType} from 'sentry/types/event';
import EventView, {EventData} from 'sentry/utils/discover/eventView';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';

import {QuickContextHoverWrapper} from './quickContextWrapper';
import {defaultRow, mockedCommit, mockedUser1, mockedUser2} from './testUtils';
import {ContextType} from './utils';

const renderQuickContextContent = (
  dataRow: EventData = defaultRow,
  contextType: ContextType = ContextType.ISSUE,
  eventView?: EventView
) => {
  const organization = Organization();
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <QuickContextHoverWrapper
        dataRow={dataRow}
        contextType={contextType}
        organization={organization}
        eventView={eventView}
      >
        Text from Child
      </QuickContextHoverWrapper>
    </QueryClientProvider>,
    {organization}
  );
};

jest.mock('sentry/utils/useLocation');

describe('Quick Context', function () {
  describe('Quick Context default behaviour', function () {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/issues/3512441874/events/oldest/',
        method: 'GET',
        body: [],
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
      jest.mocked(useLocation).mockReset();
    });

    it('Renders child', async () => {
      renderQuickContextContent();

      expect(await screen.findByText(/Text from Child/i)).toBeInTheDocument();
    });

    it('Renders quick context hover body', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/cool-team/events/6b43e285de834ec5b5fe30d62d549b20/committers/',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        method: 'GET',
        body: {},
      });
      renderQuickContextContent();

      await userEvent.hover(screen.getByText('Text from Child'));

      expect(await screen.findByTestId('quick-context-hover-body')).toBeInTheDocument();
    });

    it('Renders quick context failure message', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/cool-team/events/6b43e285de834ec5b5fe30d62d549b20/committers/',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        statusCode: 400,
      });

      renderQuickContextContent();

      await userEvent.hover(screen.getByText('Text from Child'));

      // Error is expected, do not fail when calling console.error
      jest.spyOn(console, 'error').mockImplementation();
      expect(
        await screen.findByText(/Failed to load context for column./i)
      ).toBeInTheDocument();
    });

    it('Renders issue context header with copy button', async () => {
      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        method: 'GET',
        body: {},
      });

      renderQuickContextContent();

      await userEvent.hover(screen.getByText('Text from Child'));

      expect(await screen.findByText(/Issue/i)).toBeInTheDocument();
      expect(screen.getByText(/SENTRY-VVY/i)).toBeInTheDocument();
      expect(
        screen.getByTestId('quick-context-hover-header-copy-button')
      ).toBeInTheDocument();
    });

    it('Renders release header with copy button', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/releases/${encodeURIComponent(
          'backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76'
        )}/`,
        body: ReleaseFixture({
          id: '1',
          shortVersion: 'sentry-android-shop@1.2.0',
          version: 'sentry-android-shop@1.2.0',
          dateCreated: '2010-05-17T02:41:20Z',
          lastEvent: '2011-10-17T02:41:20Z',
          firstEvent: '2010-05-17T02:41:20Z',
          status: ReleaseStatus.ACTIVE,
          commitCount: 4,
          lastCommit: mockedCommit,
          newGroups: 21,
          authors: [mockedUser1, mockedUser2],
        }),
      });

      renderQuickContextContent(defaultRow, ContextType.RELEASE);

      await userEvent.hover(screen.getByText('Text from Child'));

      expect(await screen.findByText(/Release/i)).toBeInTheDocument();
      expect(screen.getByText(/22.10.0/i)).toBeInTheDocument();
      expect(screen.getByText(/(aaf33944f93d)/i)).toBeInTheDocument();
      expect(
        screen.getByTestId('quick-context-hover-header-copy-button')
      ).toBeInTheDocument();
    });

    it('Renders event id header', async () => {
      jest.spyOn(ConfigStore, 'get').mockImplementation(() => null);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
        body: EventFixture({type: EventOrGroupType.ERROR, entries: []}),
      });

      renderQuickContextContent(defaultRow, ContextType.EVENT);

      await userEvent.hover(screen.getByText('Text from Child'));

      expect(await screen.findByText(/Event ID/i)).toBeInTheDocument();
      expect(screen.getByText(/6b43e285/i)).toBeInTheDocument();
      expect(
        screen.getByTestId('quick-context-hover-header-copy-button')
      ).toBeInTheDocument();
    });
  });
});
