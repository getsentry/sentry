import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import Orderby from 'app/views/discover/sidebar/orderby';

describe('orderBy', function () {
  let organization, project, wrapper, onChangeMock, columns;
  beforeEach(function () {
    project = TestStubs.Project();
    organization = TestStubs.Organization({projects: [project]});
    onChangeMock = jest.fn();
    columns = [
      {value: 'timestamp', label: 'timestamp'},
      {value: 'id', label: 'id'},
    ];

    wrapper = mountWithTheme(
      <Orderby value="-timestamp" columns={columns} onChange={onChangeMock} />,
      TestStubs.routerContext([{organization}])
    );
  });

  it('Renders correct initial value options', function () {
    expect(wrapper.find('SelectControl').at(0).prop('options')).toEqual([
      {value: 'timestamp', label: 'timestamp'},
      {value: 'id', label: 'id'},
    ]);

    expect(wrapper.find('SelectControl').at(1).prop('options')).toEqual([
      {value: 'asc', label: 'asc'},
      {value: 'desc', label: 'desc'},
    ]);

    expect(wrapper.find('SelectControl').at(0).props().value).toEqual('timestamp');

    expect(wrapper.find('SelectControl').at(1).props().value).toEqual('desc');
  });

  it('Changes field, preserves direction', function () {
    selectByValue(wrapper, 'id', {name: 'orderbyField', control: true});

    expect(onChangeMock).toHaveBeenCalledWith('-id');
  });

  it('Changes direction, preserves field', function () {
    selectByValue(wrapper, 'asc', {name: 'orderbyDirection', control: true});

    expect(onChangeMock).toHaveBeenCalledWith('timestamp');
  });
});
