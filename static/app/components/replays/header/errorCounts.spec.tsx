import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RawReplayErrorFixture} from 'sentry-fixture/replay/error';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ErrorCounts from 'sentry/components/replays/header/errorCounts';
import ProjectsStore from 'sentry/stores/projectsStore';

const replayRecord = ReplayRecordFixture();
const organization = OrganizationFixture();

const baseErrorProps = {id: '1', issue: '', timestamp: new Date()};

describe('ErrorCounts', () => {
  beforeEach(() => {
    ProjectsStore.loadInitialData([
      ProjectFixture({
        id: replayRecord.project_id,
        slug: 'my-js-app',
        platform: 'javascript',
      }),
      ProjectFixture({
        id: '123123123',
        slug: 'my-py-backend',
        platform: 'python',
      }),
      ProjectFixture({
        id: '234234234',
        slug: 'my-node-service',
        platform: 'node',
      }),
    ]);
  });

  it('should render 0 when there are no errors in the array', () => {
    render(<ErrorCounts replayErrors={[]} />, {
      organization,
    });
    const countNode = screen.getByLabelText('number of errors');
    expect(countNode).toHaveTextContent('0');
  });

  it('should render an icon & count when all errors come from a single project', async () => {
    const errors = [
      RawReplayErrorFixture({...baseErrorProps, 'project.name': 'my-js-app'}),
    ];

    render(<ErrorCounts replayErrors={errors} />, {
      organization,
    });

    const countNode = screen.getByLabelText('number of errors');
    expect(countNode).toHaveTextContent('1');

    const icon = await screen.findByTestId('platform-icon-javascript');
    expect(icon).toBeInTheDocument();

    expect(countNode.parentElement).toHaveAttribute(
      'href',
      '/mock-pathname/?f_e_project=my-js-app&t_main=errors'
    );
  });

  it('should render an icon & count with links when there are errors in two unique projects', async () => {
    const errors = [
      RawReplayErrorFixture({...baseErrorProps, 'project.name': 'my-js-app'}),
      RawReplayErrorFixture({...baseErrorProps, 'project.name': 'my-py-backend'}),
      RawReplayErrorFixture({...baseErrorProps, 'project.name': 'my-py-backend'}),
    ];

    render(<ErrorCounts replayErrors={errors} />, {
      organization,
    });

    const countNodes = screen.getAllByLabelText('number of errors');
    expect(countNodes[0]).toHaveTextContent('2');
    expect(countNodes[1]).toHaveTextContent('1');

    const pyIcon = await screen.findByTestId('platform-icon-python');
    expect(pyIcon).toBeInTheDocument();
    const jsIcon = await screen.findByTestId('platform-icon-javascript');
    expect(jsIcon).toBeInTheDocument();

    expect(countNodes[0]!.parentElement).toHaveAttribute(
      'href',
      '/mock-pathname/?f_e_project=my-py-backend&t_main=errors'
    );
    expect(countNodes[1]!.parentElement).toHaveAttribute(
      'href',
      '/mock-pathname/?f_e_project=my-js-app&t_main=errors'
    );
  });

  it('should render multiple icons, but a single count and link, when there are errors in three or more projects', async () => {
    const errors = [
      RawReplayErrorFixture({...baseErrorProps, 'project.name': 'my-js-app'}),
      RawReplayErrorFixture({...baseErrorProps, 'project.name': 'my-py-backend'}),
      RawReplayErrorFixture({...baseErrorProps, 'project.name': 'my-py-backend'}),
      RawReplayErrorFixture({...baseErrorProps, 'project.name': 'my-node-service'}),
      RawReplayErrorFixture({...baseErrorProps, 'project.name': 'my-node-service'}),
      RawReplayErrorFixture({...baseErrorProps, 'project.name': 'my-node-service'}),
    ];

    render(<ErrorCounts replayErrors={errors} />, {
      organization,
    });

    const countNode = screen.getByLabelText('total errors');
    expect(countNode).toHaveTextContent('6');

    const nodeIcon = await screen.findByTestId('platform-icon-node');
    expect(nodeIcon).toBeInTheDocument();

    const pyIcon = await screen.findByTestId('platform-icon-python');
    expect(pyIcon).toBeInTheDocument();

    const plusOne = screen.getByLabelText('hidden projects');
    expect(plusOne).toHaveTextContent('+1');

    expect(countNode.parentElement).toHaveAttribute(
      'href',
      '/mock-pathname/?t_main=errors'
    );
  });
});
