import React from 'react';

import {mount} from 'enzyme';
import {openCommandPalette} from 'app/actionCreators/modal';
import App from 'app/views/app';
import FormSearchStore from 'app/stores/formSearchStore';

import {navigateTo} from 'app/actionCreators/navigation';

jest.mock('jquery');
jest.mock('app/actionCreators/formSearch');
jest.mock('app/actionCreators/navigation');

describe('Command Palette Modal', function() {
  let orgsMock;

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

    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });
    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [],
    });
  });

  it('can open command palette modal and search', async function() {
    let wrapper = mount(
      <App params={{orgId: 'org-slug'}}>{<div>placeholder content</div>}</App>
    );

    // No Modal
    expect(wrapper.find('ModalDialog')).toHaveLength(0);

    openCommandPalette({params: {orgId: 'org-slug'}});
    await tick();
    await tick();
    wrapper.update();

    // Should have Modal + input
    expect(wrapper.find('ModalDialog')).toHaveLength(1);
    wrapper.find('ModalDialog input').simulate('change', {target: {value: 'bil'}});

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
        .find('ModalDialog SearchResult SearchTitle')
        .first()
        .text()
    ).toBe('billy-org Settings');

    expect(
      wrapper
        .find('ModalDialog CommandPaletteSearchResultWrapper')
        .first()
        .prop('highlighted')
    ).toBe(true);

    expect(
      wrapper
        .find('ModalDialog CommandPaletteSearchResultWrapper')
        .at(1)
        .prop('highlighted')
    ).toBe(false);

    wrapper
      .find('ModalDialog SearchResult')
      .first()
      .simulate('click');

    expect(navigateTo).toHaveBeenCalledWith('/settings/billy-org/', undefined);
  });
});
