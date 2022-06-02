import {mountWithTheme} from 'sentry-test/enzyme';

import {OrganizationContext} from 'sentry/views/organizationContext';
import ProjectFilters from 'sentry/views/projectDetail/projectFilters';

describe('ProjectDetail > ProjectFilters', () => {
  const onSearch = jest.fn();
  const tagValueLoader = jest.fn();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('recommends semver search tag', async () => {
    const organization = TestStubs.Organization();
    tagValueLoader.mockImplementationOnce(() =>
      Promise.resolve([
        {
          count: null,
          firstSeen: null,
          key: 'release.version',
          lastSeen: null,
          name: 'sentry@0.5.3',
          value: 'sentry@0.5.3',
        },
      ])
    );
    const wrapper = mountWithTheme(
      <OrganizationContext.Provider value={organization}>
        <ProjectFilters query="" onSearch={onSearch} tagValueLoader={tagValueLoader} />
      </OrganizationContext.Provider>,
      TestStubs.routerContext()
    );
    wrapper.find('SmartSearchBar textarea').simulate('click');
    wrapper
      .find('SmartSearchBar textarea')
      .simulate('change', {target: {value: 'sentry.semv'}});

    await tick();
    wrapper.update();

    expect(wrapper.find('[data-test-id="search-autocomplete-item"]').at(0).text()).toBe(
      'release:'
    );

    wrapper.find('SmartSearchBar textarea').simulate('focus');
    wrapper
      .find('SmartSearchBar textarea')
      .simulate('change', {target: {value: 'release.version:'}});

    await tick();
    wrapper.update();

    expect(wrapper.find('[data-test-id="search-autocomplete-item"]').at(4).text()).toBe(
      'sentry@0.5.3'
    );
  });
});
