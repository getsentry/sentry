import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import WidgetViewerModal from 'sentry/components/modals/widgetViewerModal';
import MemberListStore from 'sentry/stores/memberListStore';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';

jest.mock('echarts-for-react/lib/core', () => {
  // We need to do this because `jest.mock` gets hoisted by babel and `React` is not
  // guaranteed to be in scope
  const ReactActual = require('react');

  // We need a class component here because `BaseChart` passes `ref` which will
  // error if we return a stateless/functional component
  return class extends ReactActual.Component {
    render() {
      // ReactEchartsCore accepts a style prop that determines height
      return <div style={{...this.props.style, background: 'green'}}>echarts mock</div>;
    }
  };
});

const stubEl: any = (props: any) => <div>{props.children}</div>;

const api: Client = new Client();

function mountModal({initialData, widget}) {
  return mountWithTheme(
    <WidgetViewerModal
      Header={stubEl}
      Footer={stubEl}
      Body={stubEl}
      CloseButton={stubEl}
      closeModal={() => undefined}
      organization={initialData.organization}
      widget={widget}
      api={api}
    />
  );
}

describe('Modals -> WidgetViewerModal', function () {
  const initialData = initializeOrg({
    organization: {
      features: ['discover-query', 'widget-viewer-modal'],
      apdexThreshold: 400,
    },
    router: {},
    project: 1,
    projects: [],
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('Discover Area Chart Widget', function () {
    let container;
    const mockQuery = {
      conditions: 'title:/organizations/:orgId/performance/summary/',
      fields: ['count()', 'failure_count()'],
      id: '1',
      name: 'Query Name',
      orderby: '',
    };
    const mockWidget = {
      title: 'Test Widget',
      displayType: DisplayType.AREA,
      interval: '5m',
      queries: [mockQuery],
    };

    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/eventsv2/',
        body: {
          data: [
            {
              count: 129697,
              failure_count: 6426,
            },
          ],
          meta: {
            count: 'integer',
            failure_count: 'integer',
          },
        },
      });
      container = mountModal({initialData, widget: mockWidget}).container;
    });

    it('renders Edit and Open buttons', function () {
      expect(screen.getByText('Edit Widget')).toBeInTheDocument();
      expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    });

    it('renders count() and failure_count() table columns', async function () {
      expect(await screen.findByText('count()')).toBeInTheDocument();
      expect(screen.getByText('129k')).toBeInTheDocument();
      expect(screen.getByText('failure_count()')).toBeInTheDocument();
      expect(screen.getByText('6.4k')).toBeInTheDocument();
    });

    it('renders area chart', async function () {
      expect(await screen.findByText('echarts mock')).toBeInTheDocument();
    });

    it('renders Discover area chart widget viewer', function () {
      expect(container).toSnapshot();
    });

    it('redirects user to Discover when clicking Open in Discover', async function () {
      const openInDiscoverButton = await screen.findByText('Open in Discover');
      expect(openInDiscoverButton).toBeInTheDocument();
      expect(openInDiscoverButton).toHaveAttribute('href', 'test');
    });
  });

  describe('Issue Table Widget', function () {
    let container;
    const mockQuery = {
      conditions: 'is:unresolved',
      fields: ['events', 'status', 'title'],
      id: '1',
      name: 'Query Name',
      orderby: '',
    };
    const mockWidget = {
      title: 'Issue Widget',
      displayType: DisplayType.TABLE,
      interval: '5m',
      queries: [mockQuery],
      widgetType: WidgetType.ISSUE,
    };
    beforeEach(function () {
      MemberListStore.loadInitialData([]);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'GET',
        body: [
          {
            id: '1',
            title: 'Error: Failed',
            project: {
              id: '3',
            },
            status: 'unresolved',
            lifetime: {count: 10},
            count: 6,
            userCount: 3,
          },
        ],
      });
      container = mountModal({initialData, widget: mockWidget}).container;
    });

    it('renders widget title', function () {
      expect(screen.getByText('Issue Widget')).toBeInTheDocument();
    });

    it('renders Edit and Open buttons', function () {
      expect(screen.getByText('Edit Widget')).toBeInTheDocument();
      expect(screen.getByText('Open in Issues')).toBeInTheDocument();
    });

    it('renders events, status, and title table columns', async function () {
      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('Error: Failed')).toBeInTheDocument();
      expect(screen.getByText('events')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('status')).toBeInTheDocument();
      expect(screen.getByText('unresolved')).toBeInTheDocument();
    });

    it('renders Issue table widget viewer', function () {
      expect(container).toSnapshot();
    });

    it('redirects user to Issues when clicking Open in Issues', async function () {
      const openInIssuesButton = await screen.findByText('Open in Issues');
      expect(openInIssuesButton).toBeInTheDocument();
      expect(openInIssuesButton).toHaveAttribute('href', 'test');
    });
  });
});
