import React from 'react';
import {mount} from 'enzyme';

import OrderBy from 'app/views/organizationDiscover/sidebar/orderBy';

import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';

describe('orderBy', function() {
  let organization, project, queryBuilder, wrapper, onChangeMock, columns;
  beforeEach(function() {
    project = TestStubs.Project();
    organization = TestStubs.Organization({projects: [project]});
    queryBuilder = createQueryBuilder({}, organization);
    onChangeMock = jest.fn();
    columns = [{value: 'timestamp', label: 'timestamp'}, {value: 'id', label: 'id'}];

    wrapper = mount(
      <OrderBy
        value={'-timestamp'}
        columns={columns}
        onChange={val => queryBuilder.updateField('orderby', val)}
      />,
      TestStubs.routerContext([{organization}])
    );
  });

  it('Changes direction, preserves field', function() {
    // console.log(wrapper.debug());
    wrapper.instance().updateDirection('asc');
    wrapper.update();
    console.log(wrapper.props());

    // console.log(wrapper.instance().getInternal())

    expect(wrapper.instance().getExternal()).toEqual('timestamp');
  });

  it('Changes field, preserves direction', function() {
    wrapper.instance().updateField('id');
    wrapper.update();

    expect(wrapper.instance().getExternal()).toEqual('id');
  });
});
