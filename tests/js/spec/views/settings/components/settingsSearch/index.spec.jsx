import React from 'react';
import {mount} from 'enzyme';

import SettingsSearch from 'app/views/settings/components/settingsSearch';
import FormSearchStore from 'app/stores/formSearchStore';

jest.mock('jquery');
jest.mock('app/actionCreators/formSearch');
jest.mock('lodash/debounce', () => jest.fn(fn => fn));

describe('SettingsSearch', function() {
  beforeEach(function() {
    FormSearchStore.onLoadSearchMap([]);
    MockApiClient.clearMockResponses();
  });

  it('renders', async function() {
    let wrapper = mount(<SettingsSearch params={{orgId: 'org-slug'}} />);

    // renders input
    expect(wrapper.find('SearchInput')).toHaveLength(1);
    expect(wrapper.find('input').prop('placeholder')).toBe(
      'Search (press "/" to start search)'
    );
  });

  it('can focus when `handleFocusSearch` is called and target is not search input', function() {
    let wrapper = mount(<SettingsSearch params={{orgId: 'org-slug'}} />);
    let searchInput = wrapper.instance().searchInput;
    let focusSpy = jest.spyOn(searchInput, 'focus');

    wrapper.instance().handleFocusSearch({
      preventDefault: () => {},
      target: null,
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it('does not focus search input if it is current target and `handleFocusSearch` is called', function() {
    let wrapper = mount(<SettingsSearch params={{orgId: 'org-slug'}} />);
    let searchInput = wrapper.instance().searchInput;
    let focusSpy = jest.spyOn(searchInput, 'focus');

    wrapper.instance().handleFocusSearch({
      preventDefault: () => {},
      target: searchInput,
    });

    expect(focusSpy).not.toHaveBeenCalled();
  });
});
