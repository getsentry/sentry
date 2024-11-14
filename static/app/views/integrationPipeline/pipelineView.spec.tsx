import {render, screen} from 'sentry-test/reactTestingLibrary';

import PipelineView from 'sentry/views/integrationPipeline/pipelineView';

function MockAwsLambdaProjectSelect() {
  return <div>mock_AwsLambdaProjectSelect</div>;
}

jest.mock(
  'sentry/views/integrationPipeline/awsLambdaProjectSelect',
  () => MockAwsLambdaProjectSelect
);

describe('PipelineView', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders awsLambdaProjectSelect', () => {
    render(<PipelineView pipelineName="awsLambdaProjectSelect" someField="someVal" />, {
      // XXX(epurkhiser): The pipeline view renders a Router inside of it. Stop
      // our test renderer from rendering it's Router by setting the wrapper to
      // undefined.
      wrapper: undefined,
    });

    expect(screen.getByText('mock_AwsLambdaProjectSelect')).toBeInTheDocument();

    expect(document.title).toBe('AWS Lambda Select Project');
  });

  it('errros on invalid pipelineName', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(<PipelineView pipelineName="other" />, {
        // XXX(epurkhiser): The pipeline view renders a Router inside of it. Stop
        // our test renderer from rendering it's Router by setting the wrapper to
        // undefined.
        wrapper: undefined,
      })
    ).toThrow('Invalid pipeline name other');
  });
});
