import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFilters} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useProjectSdkUpdates} from 'sentry/utils/useProjectSdkUpdates';
import {ReplaySearchAlert} from 'sentry/views/replays/list/replaySearchAlert';

jest.mock('sentry/utils/useProjects');
jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useProjectSdkUpdates');

const mockUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;
const mockUsePageFilters = usePageFilters as jest.MockedFunction<typeof usePageFilters>;
const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;
const mockUseProjectSdkUpdates = useProjectSdkUpdates as jest.MockedFunction<
  typeof useProjectSdkUpdates
>;

const project = TestStubs.Project();

function getMockContext() {
  return TestStubs.routerContext([{}]);
}

function mockLocationReturn(query: string = ''): ReturnType<typeof useLocation> {
  return {
    query: {
      query,
    },
    pathname: '',
    search: '',
    hash: '',
    state: {},
    action: 'PUSH',
    key: '',
  };
}

describe('ReplaySearchAlert', () => {
  beforeEach(() => {
    mockUseProjects.mockReturnValue({
      projects: [project],
      fetching: false,
      hasMore: false,
      onSearch: () => Promise.resolve(),
      fetchError: null,
      initiallyLoaded: false,
      placeholders: [],
    });

    mockUsePageFilters.mockReturnValue({
      selection: {
        // for some reason project.id selections are numbers, but elsewhere project.id is string
        projects: [Number(project.id)],
        datetime: {} as PageFilters['datetime'],
        environments: [],
      },
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
    });

    mockUseLocation.mockReturnValue(mockLocationReturn());

    mockUseProjectSdkUpdates.mockReturnValue({
      type: 'initial',
    });
  });

  it('should not render search alert by default', () => {
    const {container} = render(<ReplaySearchAlert />, {
      context: getMockContext(),
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('should render dismissible alert if minSdk <= 7.44.0', () => {
    mockUseProjectSdkUpdates.mockReturnValue({
      type: 'resolved',
      // @ts-expect-error - ts doesn't play nice with overloaded returns
      data: [
        {
          projectId: project.id,
          sdkName: 'javascript',
          sdkVersion: '7.0.0',
          suggestions: [],
        },
      ],
    });

    const {container} = render(<ReplaySearchAlert />, {
      context: getMockContext(),
    });

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.queryByTestId('min-sdk-alert')).toBeInTheDocument();
    expect(container).toHaveTextContent(
      "Search for dom elements clicked during a replay by using our new search key 'click'. Sadly, it requires an SDK version >= 7.44.0"
    );
  });

  it('should render update alert if minSdk <= 7.44.0 and search contains "click" key', () => {
    mockUseLocation.mockReturnValue(mockLocationReturn('click.alt:foo'));

    mockUseProjectSdkUpdates.mockReturnValue({
      type: 'resolved',
      // @ts-expect-error - ts doesn't play nice with overloaded returns
      data: [
        {
          projectId: project.id,
          sdkName: 'javascript',
          sdkVersion: '7.0.0',
          suggestions: [],
        },
      ],
    });

    const {container} = render(<ReplaySearchAlert />, {
      context: getMockContext(),
    });

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.queryByTestId('min-sdk-alert')).toBeInTheDocument();
    expect(container).toHaveTextContent(
      "Search field 'click' requires a minimum SDK version of >= 7.44.0."
    );
  });
});
