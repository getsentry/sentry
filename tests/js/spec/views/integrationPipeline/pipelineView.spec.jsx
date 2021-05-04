import {shallow} from 'sentry-test/enzyme';

import AwsLambdaProjectSelect from 'app/views/integrationPipeline/awsLambdaProjectSelect';
import PipelineView from 'app/views/integrationPipeline/pipelineView';

describe('PipelineView', () => {
  it('renders awsLambdaProjectSelect', () => {
    const wrapper = shallow(
      <PipelineView pipelineName="awsLambdaProjectSelect" someField="someVal" />,
      TestStubs.routerContext()
    );
    expect(wrapper.find(AwsLambdaProjectSelect).prop('someField')).toBe('someVal');
    expect(document.title).toBe('AWS Lambda Select Project');
  });
  it('errros on invalid pipelineName', () => {
    expect(() =>
      shallow(<PipelineView pipelineName="other" />, TestStubs.routerContext())
    ).toThrow('Invalid pipeline name other');
  });
});
