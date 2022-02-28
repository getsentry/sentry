import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import PipelineView from 'sentry/views/integrationPipeline/pipelineView';

function MockAwsLambdaProjectSelect() {
  return <div>mock_AwsLambdaProjectSelect</div>;
}

jest.mock(
  'sentry/views/integrationPipeline/awsLambdaProjectSelect',
  () => MockAwsLambdaProjectSelect
);

describe('PipelineView', () => {
  it('renders awsLambdaProjectSelect', () => {
    mountWithTheme(
      <PipelineView pipelineName="awsLambdaProjectSelect" someField="someVal" />
    );

    expect(screen.getByText('mock_AwsLambdaProjectSelect')).toBeInTheDocument();

    expect(document.title).toBe('AWS Lambda Select Project');
  });

  it('errros on invalid pipelineName', () => {
    jest.spyOn(console, 'error');

    // eslint-disable-next-line no-console
    console.error.mockImplementation(() => {});

    expect(() => mountWithTheme(<PipelineView pipelineName="other" />)).toThrow(
      'Invalid pipeline name other'
    );

    // eslint-disable-next-line no-console
    console.error.mockRestore();
  });
});
