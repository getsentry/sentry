import selectEvent from 'react-select-event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AwsLambdaProjectSelect from 'sentry/views/integrationPipeline/awsLambdaProjectSelect';

describe('AwsLambdaProjectSelect', () => {
  let projects;
  let windowAssignMock;

  beforeEach(() => {
    windowAssignMock = jest.fn();
    window.location.assign = windowAssignMock;
    projects = [
      TestStubs.Project(),
      TestStubs.Project({id: '53', name: 'My Proj', slug: 'my-proj'}),
    ];
  });

  it('submit project', async () => {
    render(<AwsLambdaProjectSelect projects={projects} />);

    await selectEvent.select(screen.getByRole('textbox'), 'my-proj');
    userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(windowAssignMock).toHaveBeenCalledWith(
      `${window.location.origin}/extensions/aws_lambda/setup/?projectId=53`
    );
  });
});
