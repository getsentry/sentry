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
    render(<PipelineView pipelineName="awsLambdaProjectSelect" someField="someVal" />);

    expect(screen.getByText('mock_AwsLambdaProjectSelect')).toBeInTheDocument();

    expect(document.title).toBe('AWS Lambda Select Project');
  });

  it('errros on invalid pipelineName', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<PipelineView pipelineName="other" />)).toThrow(
      'Invalid pipeline name other'
    );
  });
});
