import {render} from 'sentry-test/reactTestingLibrary';

import {UpdateSdkSuggestion} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {ReplaySearchMinSdkAlert} from 'sentry/views/replays/list/replaySearchAlert';

jest.mock('sentry/utils/useProjects');
jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

const mockUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;
const mockUsePageFilters = usePageFilters as jest.MockedFunction<typeof usePageFilters>;
const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;

const project = TestStubs.Project();

function getMockContext() {
  return TestStubs.routerContext([{}]);
}

describe('ReplaySearchAlert', () => {
  beforeEach(() => {
    // @ts-ignore
    mockUseProjects.mockReturnValue({
      projects: [project],
    });

    // @ts-ignore
    mockUsePageFilters.mockReturnValue({
      // @ts-ignore
      selection: {
        // for some reason project.id selections are numbers, but elsewhere project.id is string
        projects: [Number(project.id)],
      },
    });

    // @ts-ignore
    mockUseLocation.mockReturnValue({
      query: {
        query: '',
      },
    });
  });

  it('should not render search alert by default', () => {
    const {container} = render(<ReplaySearchMinSdkAlert />, {
      context: getMockContext(),
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('should render update alert if minSdk <= 7.44.0 and search contains "click" key', () => {
    // @ts-ignore
    mockUseLocation.mockReturnValue({
      query: {
        query: 'click.alt:foo',
      },
    });

    const {container} = render(
      <ReplaySearchMinSdkAlert
        sdkUpdates={[
          {
            projectId: project.id,
            sdkName: 'javascript',
            sdkVersion: '7.0.0',
            suggestions: [],
          },
        ]}
      />,
      {
        context: getMockContext(),
      }
    );

    expect(container).not.toBeEmptyDOMElement();
    expect(container).toHaveTextContent(
      'Searching by click requires a minimum SDK version of v7.44.0'
    );
  });

  it('should render update alert w/ recommendation if minSdk <= 7.44.0 and search contains "click" key and sdkUpdates include suggestion', () => {
    // @ts-ignore
    mockUseLocation.mockReturnValue({
      query: {
        query: 'click.alt:foo',
      },
    });

    const {container} = render(
      <ReplaySearchMinSdkAlert
        sdkUpdates={[
          {
            projectId: project.id,
            sdkName: 'javascript',
            sdkVersion: '7.0.0',
            suggestions: [
              {
                type: 'updateSdk',
                newSdkVersion: '8.0.0',
                sdkName: 'javascript',
                sdkUrl: 'https://sentry.io',
              } as UpdateSdkSuggestion,
            ],
          },
        ]}
      />,
      {
        context: getMockContext(),
      }
    );

    expect(container).not.toBeEmptyDOMElement();
    expect(container).toHaveTextContent(
      'Searching by click requires a minimum SDK version of javascript@v7.44.0. Update to javascript@v8.0.0'
    );
  });
});
