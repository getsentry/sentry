import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectFilters from 'app/views/projectDetail/projectFilters';

describe('ProjectDetail > ProjectFilters', () => {
  const onSearch = jest.fn();
  const tagValueLoader = jest.fn();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('recommends semver search tag', async () => {
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
      <ProjectFilters query="" onSearch={onSearch} tagValueLoader={tagValueLoader} />,
      TestStubs.routerContext()
    );
    wrapper.find('SmartSearchBar textarea').simulate('click');
    wrapper
      .find('SmartSearchBar textarea')
      .simulate('change', {target: {value: 'sentry.semv'}});

    await tick();
    wrapper.update();

    expect(wrapper.find('[data-test-id="search-autocomplete-item"]').at(0).text()).toBe(
      'release.version:'
    );

    wrapper.find('SmartSearchBar textarea').simulate('focus');
    wrapper
      .find('SmartSearchBar textarea')
      .simulate('change', {target: {value: 'release.version:'}});

    await tick();
    wrapper.update();

    expect(wrapper.find('[data-test-id="search-autocomplete-item"]').at(0).text()).toBe(
      'sentry@0.5.3'
    );
  });
});
