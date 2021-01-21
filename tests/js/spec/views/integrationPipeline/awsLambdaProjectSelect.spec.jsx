import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import AwsLambdaProjectSelect from 'app/views/integrationPipeline/awsLambdaProjectSelect';

describe('AwsLambdaProjectSelect', () => {
  let projects;
  let wrapper;
  let windowAssignMock;
  beforeEach(() => {
    projects = [
      TestStubs.Project(),
      TestStubs.Project({id: '53', name: 'My Proj', slug: 'my-proj'}),
    ];
    wrapper = mountWithTheme(
      <AwsLambdaProjectSelect projects={projects} />,
      TestStubs.routerContext()
    );
    windowAssignMock = jest.fn();
    window.location.assign = windowAssignMock;
  });
  it('submit project', () => {
    selectByValue(wrapper, '53', {name: 'projectId', control: true});

    wrapper.find('form').simulate('submit');
    const {
      location: {origin},
    } = window;
    expect(windowAssignMock).toHaveBeenCalledWith(
      `${origin}/extensions/aws_lambda/setup/?projectId=53`
    );
  });
});
