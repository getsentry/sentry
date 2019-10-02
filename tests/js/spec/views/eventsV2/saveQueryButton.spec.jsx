import React from 'react';
import {mount} from 'enzyme';
import {browserHistory} from 'react-router';

import EventSaveQueryButton from 'app/views/eventsV2/saveQueryButton';
import {ALL_VIEWS} from 'app/views/eventsV2/data';
import EventView from 'app/views/eventsV2/eventView';

describe('EventsV2 > SaveQueryButton', function() {
  const errorsView = EventView.fromEventViewv1(
    ALL_VIEWS.find(view => view.name === 'Errors')
  );
  let organization, location;
  beforeEach(function() {
    organization = TestStubs.Organization();
    location = {
      pathname: '/organization/eventsv2/',
      query: {},
    };
  });

  it('renders a button', function() {
    const wrapper = mount(
      <EventSaveQueryButton
        organization={organization}
        location={location}
        isEditing={false}
        eventView={errorsView}
      />,
      TestStubs.routerContext()
    );
    const button = wrapper.find('StyledDropdownButton');
    expect(button.text()).toEqual('Save Search');
  });

  it('renders a popover for a new query', function() {
    const wrapper = mount(
      <EventSaveQueryButton
        organization={organization}
        location={location}
        isEditing={false}
        eventView={errorsView}
      />,
      TestStubs.routerContext()
    );
    const button = wrapper.find('StyledDropdownButton');
    button.simulate('click');

    const input = wrapper.find('SaveQueryContainer input');
    expect(input).toHaveLength(1);

    const submit = wrapper.find('SaveQueryContainer Button');
    expect(submit).toHaveLength(1);
    expect(submit.text()).toEqual('Save');
  });

  it('renders a popover for an existing query', function() {
    const wrapper = mount(
      <EventSaveQueryButton
        organization={organization}
        location={location}
        eventView={errorsView}
        isEditing
      />,
      TestStubs.routerContext()
    );
    const button = wrapper.find('StyledDropdownButton');
    button.simulate('click');

    const submit = wrapper.find('SaveQueryContainer Button');
    expect(submit).toHaveLength(1);
    expect(submit.text()).toEqual('Update');
  });

  it('sets input value based on props', function() {
    const wrapper = mount(
      <EventSaveQueryButton
        organization={organization}
        location={location}
        eventView={errorsView}
      />,
      TestStubs.routerContext()
    );
    const button = wrapper.find('StyledDropdownButton');
    button.simulate('click');

    // Creating a new query
    expect(wrapper.find('StyledInput').props().value).toEqual('');

    // Enter edit mode
    wrapper.setProps({isEditing: true});
    wrapper.update();
    expect(wrapper.find('StyledInput').props().value).toEqual(errorsView.name);

    // Edit a different view
    const otherView = {...errorsView, name: 'other view', id: 99};
    wrapper.setProps({isEditing: true, eventView: otherView});
    wrapper.update();
    expect(wrapper.find('StyledInput').props().value).toEqual(otherView.name);

    // Leave edit mode
    wrapper.setProps({isEditing: false});
    wrapper.update();
    expect(wrapper.find('StyledInput').props().value).toEqual('');
  });

  it('saves a new query', async function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/saved/',
      method: 'POST',
      body: {
        id: '2',
        name: 'my query',
        fields: ['title', 'count()'],
        fieldnames: ['title', 'total'],
      },
    });
    const wrapper = mount(
      <EventSaveQueryButton
        organization={organization}
        location={location}
        eventView={errorsView}
      />,
      TestStubs.routerContext()
    );
    const button = wrapper.find('StyledDropdownButton');
    button.simulate('click');

    const input = wrapper.find('SaveQueryContainer input');
    input.simulate('change', {target: {value: 'my query'}});

    const submit = wrapper.find('button[aria-label="Save"]');
    submit.simulate('click');

    // Wait for reflux
    await tick();
    await tick();

    // should redirect to query
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: {
        field: ['title', 'count()'],
        id: '2',
        fieldnames: ['title', 'total'],
        name: 'my query',
        query: '',
        sort: [],
        tag: [],
      },
    });
  });

  it('updates an existing query', async function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/saved/1/',
      method: 'PUT',
      body: {
        id: '1',
        name: 'my query',
        fields: ['title', 'count()'],
        fieldnames: ['title', 'total'],
      },
    });
    const errors = EventView.fromEventViewv1(
      ALL_VIEWS.find(view => view.name === 'Errors')
    );
    errors.id = '1';
    const wrapper = mount(
      <EventSaveQueryButton
        organization={organization}
        location={location}
        eventView={errors}
        isEditing
      />,
      TestStubs.routerContext()
    );
    const button = wrapper.find('StyledDropdownButton');
    button.simulate('click');

    const input = wrapper.find('SaveQueryContainer input');
    input.simulate('change', {target: {value: 'my query'}});

    const submit = wrapper.find('button[aria-label="Update"]');
    submit.simulate('click');

    // Wait for reflux
    await tick();
    await tick();

    // should redirect to query
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: location.pathname,
      query: {
        field: ['title', 'count()'],
        id: '1',
        fieldnames: ['title', 'total'],
        name: 'my query',
        query: '',
        sort: [],
        tag: [],
      },
    });
  });
});
