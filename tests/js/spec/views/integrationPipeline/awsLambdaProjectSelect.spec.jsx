import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import AwsLambdaProjectSelect from 'app/views/integrationPipeline/awsLambdaProjectSelect';

describe('AwsLambdaProjectSelect', () => {
  let projects;
  let wrapper;
  let windowReplaceMock;
  beforeEach(() => {
    projects = [
      TestStubs.Project(),
      TestStubs.Project({id: '53', name: 'My Proj', slug: 'my-proj'}),
    ];
    wrapper = mountWithTheme(
      <AwsLambdaProjectSelect projects={projects} />,
      TestStubs.routerContext()
    );
    windowReplaceMock = jest.fn();
    window.location.replace = windowReplaceMock;
    window.localStorage.setItem('AWS_EXTERNAL_ID', 'my_external_id');
  });
  it('submit project', () => {
    selectByValue(wrapper, '53', {name: 'projectId', control: true});

    wrapper.find('form').simulate('submit');
    const {
      location: {origin},
    } = window;
    expect(windowReplaceMock).toHaveBeenCalledWith(
      `${origin}/extensions/aws_lambda/setup/?project_id=53&aws_external_id=my_external_id`
    );
  });
});
