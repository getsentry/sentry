import React from 'react';
import {mount} from 'enzyme';

import ProjectSavedSearches from 'app/views/projectSavedSearches';

describe('ProjectSavedSearches', function() {
  let wrapper;
  const routerContext = TestStubs.routerContext();
  const org = routerContext.context.organization;
  const project = routerContext.context.project;

  beforeEach(function() {
    MockApiClient.mockAsync = false;
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/searches/`,
      method: 'GET',
      body: TestStubs.Searches(),
    });

    wrapper = mount(
      <ProjectSavedSearches params={{orgId: org.slug, projectId: project.slug}} />,
      routerContext
    );
  });

  it('renders empty', function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/searches/`,
      method: 'GET',
      body: [],
    });

    wrapper = mount(
      <ProjectSavedSearches params={{orgId: org.slug, projectId: project.slug}} />,
      routerContext
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('renders', function() {
    expect(wrapper).toMatchSnapshot();
  });

  it('removes a search query', function() {
    const removed = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/searches/2/`,
      method: 'DELETE',
    });

    expect(removed).not.toHaveBeenCalled();

    wrapper
      .find('Button')
      .first()
      .simulate('click');

    $(document.body)
      .find('.modal button:contains("Confirm")')
      .click();

    expect(removed).toHaveBeenCalled();
  });

  it('rolls back update default on error', function() {
    const url = `/projects/${org.slug}/${project.slug}/searches/2/`;
    const remove = MockApiClient.addMockResponse({
      url,
      method: 'DELETE',
      statusCode: 400,
    });

    MockApiClient.mockAsync = true;

    // Initially has two rows
    expect(wrapper.find('SavedSearchRow')).toHaveLength(2);

    expect(remove).not.toHaveBeenCalled();

    // Remove first row
    wrapper
      .find('Button')
      .first()
      .simulate('click');

    $(document.body)
      .find('.modal button:contains("Confirm")')
      .click();

    wrapper.update();

    // Should update have 1 row remaining
    expect(wrapper.find('SavedSearchRow')).toHaveLength(1);

    // calls API, API returns an error

    setTimeout(() => {
      wrapper.update();

      // Reverts back to initial state
      expect(wrapper.find('SavedSearchRow')).toHaveLength(2);
    }, 1);

    MockApiClient.mockAsync = false;
  });

  it('updates a search query to default', function() {
    const url = `/projects/${org.slug}/${project.slug}/searches/2/`;
    const update = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

    expect(update).not.toHaveBeenCalled();

    wrapper
      .find('input[type="radio"]')
      .first()
      .simulate('change');

    expect(update).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          isUserDefault: true,
        },
      })
    );

    expect(
      wrapper
        .find('input[type="radio"]')
        .first()
        .prop('checked')
    ).toBe(true);

    // Update Team default
    wrapper
      .find('input[type="radio"]')
      .at(1)
      .simulate('change');

    expect(update).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          isDefault: true,
        },
      })
    );

    expect(
      wrapper
        .find('input[type="radio"]')
        .at(1)
        .prop('checked')
    ).toBe(true);
  });

  it('rolls back update default on PUT error', function() {
    const url = `/projects/${org.slug}/${project.slug}/searches/2/`;
    const update = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      statusCode: 400,
    });

    MockApiClient.mockAsync = true;

    // User default initial value is false
    expect(
      wrapper
        .find('input[type="radio"]')
        .first()
        .prop('checked')
    ).toBe(false);

    expect(update).not.toHaveBeenCalled();

    // Select as user default
    wrapper
      .find('input[type="radio"]')
      .first()
      .simulate('change');

    // Should update and be checked
    expect(
      wrapper
        .find('input[type="radio"]')
        .first()
        .prop('checked')
    ).toBe(true);

    // calls API, API returns an error

    setTimeout(() => {
      wrapper.update();

      // Reverts back to initial state
      expect(
        wrapper
          .find('input[type="radio"]')
          .first()
          .prop('checked')
      ).toBe(false);
    }, 1);

    MockApiClient.mockAsync = false;
  });
});
