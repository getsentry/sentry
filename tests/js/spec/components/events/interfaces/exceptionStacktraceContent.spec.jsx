import React from 'react';
import cloneDeep from 'lodash/cloneDeep';

import {mount} from 'sentry-test/enzyme';

import ExceptionStacktraceContent from 'app/components/events/interfaces/exceptionStacktraceContent';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

describe('ExceptionStacktraceContent', () => {
  const stacktrace = {
    frames: [
      {
        function: null,
        colNo: null,
        vars: {},
        symbol: null,
        module: '<unknown module>',
        lineNo: null,
        errors: null,
        package: null,
        absPath:
          'https://sentry.io/hiventy/kraken-prod/issues/438681831/?referrer=slack#',
        inApp: false,
        instructionAddr: null,
        filename: '/hiventy/kraken-prod/issues/438681831/',
        platform: null,
        context: [],
        symbolAddr: null,
      },
      {
        absPath: 'foo/baz.c',
        colNo: null,
        context: [],
        errors: null,
        filename: 'foo/baz.c',
        function: null,
        inApp: false,
        instructionAddr: null,
        lineNo: 1,
        module: null,
        package: null,
        platform: null,
        rawFunction: null,
        symbol: null,
        symbolAddr: null,
        trust: null,
        vars: null,
      },
    ],
  };

  const props = {
    stackView: 'app',
    platform: 'node',
    expandFirstFrame: true,
    newestFirst: true,
    chainedException: false,
    event: {
      entries: [],
      crashFile: {
        sha1: 'sha1',
        name: 'name.dmp',
        dateCreated: '2019-05-21T18:01:48.762Z',
        headers: {'Content-Type': 'application/octet-stream'},
        id: '12345',
        size: 123456,
        type: 'event.minidump',
      },
      culprit: '',
      dateCreated: '2019-05-21T18:00:23Z',
      'event.type': 'error',
      eventID: '123456',
      groupID: '1',
      id: '98654',
      location: 'main.js',
      message: 'TestException',
      platform: 'native',
      projectID: '123',
      tags: [{value: 'production', key: 'production'}],
      title: 'TestException',
    },
    data: stacktrace,
    stacktrace,
    framesOmitted: null,
    registers: null,
    hasSystemFrames: false,
  };

  it('default behaviour', () => {
    const wrapper = mount(<ExceptionStacktraceContent {...props} />);
    expect(wrapper).toSnapshot();
  });

  it('should return an emptyRender', () => {
    const wrapper = mount(
      <ExceptionStacktraceContent {...props} stacktrace={undefined} />
    );
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('should return the EmptyMessage component', () => {
    const wrapper = mount(<ExceptionStacktraceContent {...props} />);
    const emptyMessageElement = wrapper.find(EmptyMessage).exists();
    expect(emptyMessageElement).toBe(true);
  });

  it('should not return the EmptyMessage component', () => {
    const modifiedProps = cloneDeep(props);
    modifiedProps.stacktrace.frames[0].inApp = true;
    const wrapper = mount(<ExceptionStacktraceContent {...modifiedProps} />);
    const emptyMessageElement = wrapper.find(EmptyMessage).exists();
    expect(emptyMessageElement).toBe(false);
  });

  it('should render system frames if "stackView: app" and there are no inApp frames and is a chained exceptions', () => {
    const wrapper = mount(<ExceptionStacktraceContent {...props} chainedException />);
    expect(wrapper.find('Line').length).toBe(2);
  });

  it('should not render system frames if "stackView: app" and there are inApp frames and is a chained exceptions', () => {
    const modifiedProps = cloneDeep(props);
    modifiedProps.stacktrace.frames[0].inApp = true;
    const wrapper = mount(
      <ExceptionStacktraceContent {...modifiedProps} chainedException />
    );

    // There must be two elements, one being the inApp frame and the other
    // the last frame which is non-app frame
    expect(wrapper.find('Line').length).toBe(2);

    // inApp === true
    expect(wrapper.find('.filename').at(1).text()).toBe(
      props.stacktrace.frames[0].filename
    );

    // inApp === false
    expect(wrapper.find('.filename').at(0).text()).toBe(
      props.stacktrace.frames[1].filename
    );
  });
});
