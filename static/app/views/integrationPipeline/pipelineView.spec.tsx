// The pipeline view renders a Router inside of it and
// does not need the providers provided by our wrapped render function.
// Use the original to avoid doubling up.
// eslint-disable-next-line no-restricted-imports
import {render, screen} from '@testing-library/react';

import PipelineView from 'sentry/views/integrationPipeline/pipelineView';

function MockAwsLambdaProjectSelect() {
  return <div>mock_AwsLambdaProjectSelect</div>;
}

vi.mock(
  'sentry/views/integrationPipeline/awsLambdaProjectSelect',
  () => MockAwsLambdaProjectSelect
);

describe('PipelineView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders awsLambdaProjectSelect', () => {
    render(<PipelineView pipelineName="awsLambdaProjectSelect" someField="someVal" />);

    expect(screen.getByText('mock_AwsLambdaProjectSelect')).toBeInTheDocument();

    expect(document.title).toBe('AWS Lambda Select Project');
  });

  it('errros on invalid pipelineName', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<PipelineView pipelineName="other" />)).toThrow(
      'Invalid pipeline name other'
    );
  });
});
