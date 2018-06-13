import React from 'react';
import {mount} from 'enzyme';

import SettingsSearch from 'app/views/settings/components/settingsSearch';
import FormSearchStore from 'app/stores/formSearchStore';

import {navigateTo} from 'app/actionCreators/navigation';

jest.mock('jquery');
jest.mock('app/actionCreators/formSearch');
jest.mock('app/actionCreators/navigation');

const SETTINGS_SEARCH_PLACEHOLDER = 'Search';
describe('SettingsSearch', function() {
  let orgsMock;
  let routerContext = TestStubs.routerContext([
    {
      router: TestStubs.router({
        params: {orgId: 'org-slug'},
      }),
    },
  ]);

  beforeEach(function() {
    FormSearchStore.onLoadSearchMap([]);
    MockApiClient.clearMockResponses();
    orgsMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization({slug: 'billy-org', name: 'billy org'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      query: 'foo',
      body: [TestStubs.Project({slug: 'foo-project'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      query: 'foo',
      body: [TestStubs.Team({slug: 'foo-team'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      query: 'foo',
      body: TestStubs.Members(),
    });
  });

  it('renders', async function() {
    let wrapper = mount(<SettingsSearch params={{orgId: 'org-slug'}} />, routerContext);

    // renders input
    expect(wrapper.find('SearchInput')).toHaveLength(1);
    expect(wrapper.find('input').prop('placeholder')).toBe(SETTINGS_SEARCH_PLACEHOLDER);
  });

  it('can focus when `handleFocusSearch` is called and target is not search input', function() {
    let wrapper = mount(<SettingsSearch params={{orgId: 'org-slug'}} />, routerContext);
    let searchInput = wrapper.instance().searchInput;
    let focusSpy = jest.spyOn(searchInput, 'focus');

    wrapper.instance().handleFocusSearch({
      preventDefault: () => {},
      target: null,
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it('does not focus search input if it is current target and `handleFocusSearch` is called', function() {
    let wrapper = mount(<SettingsSearch params={{orgId: 'org-slug'}} />, routerContext);
    let searchInput = wrapper.instance().searchInput;
    let focusSpy = jest.spyOn(searchInput, 'focus');

    wrapper.instance().handleFocusSearch({
      preventDefault: () => {},
      target: searchInput,
    });

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('can search', async function() {
    let wrapper = mount(<SettingsSearch params={{orgId: 'org-slug'}} />, routerContext);

    wrapper.find('input').simulate('change', {target: {value: 'bil'}});

    await tick();
    wrapper.update();

    expect(orgsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        // This nested 'query' is correct
        query: {query: 'bil'},
      })
    );

    expect(
      wrapper
        .find('SearchResult [data-test-id="badge-display-name"]')
        .first()
        .text()
    ).toBe('billy-org Dashboard');

    expect(
      wrapper
        .find('SearchResultWrapper')
        .first()
        .prop('highlighted')
    ).toBe(true);

    expect(
      wrapper
        .find('SearchResultWrapper')
        .at(1)
        .prop('highlighted')
    ).toBe(false);

    wrapper
      .find('SearchResult')
      .first()
      .simulate('click');

    expect(navigateTo).toHaveBeenCalledWith('/billy-org/', expect.anything());
  });
});
