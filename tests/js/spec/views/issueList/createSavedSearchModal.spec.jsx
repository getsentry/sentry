import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import CreateSavedSearchModal from 'sentry/views/issueList/createSavedSearchModal';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('CreateSavedSearchModal', function () {
  let wrapper, organization, createMock;

  beforeEach(function () {
    organization = TestStubs.Organization({
      access: ['org:write'],
    });
    wrapper = mountWithTheme(
      <CreateSavedSearchModal
        Header={p => p.children}
        Body={p => p.children}
        Footer={p => p.children}
        organization={organization}
        query="is:unresolved assigned:lyn@sentry.io"
        sort={IssueSortOptions.DATE}
      />
    );

    createMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      method: 'POST',
      body: {id: '1', name: 'test', query: 'is:unresolved assigned:lyn@sentry.io'},
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('saves a search', function () {
    it('saves a search when query is not changed', async function () {
      wrapper
        .find('input[name="name"]')
        .simulate('change', {target: {value: 'new search name'}});
      wrapper.find('button[data-test-id="form-submit"]').simulate('submit');

      await tick();
      expect(createMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            name: 'new search name',
            query: 'is:unresolved assigned:lyn@sentry.io',
            sort: IssueSortOptions.DATE,
            type: 0,
          },
        })
      );
    });

    it('saves a search when query is changed', async function () {
      wrapper
        .find('input[name="name"]')
        .simulate('change', {target: {value: 'new search name'}});
      wrapper
        .find('input[name="query"]')
        .simulate('change', {target: {value: 'is:resolved'}});
      selectByValue(wrapper, IssueSortOptions.PRIORITY, {name: 'sort', control: true});
      wrapper.find('button[data-test-id="form-submit"]').simulate('submit');

      await tick();
      expect(createMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            name: 'new search name',
            query: 'is:resolved',
            sort: IssueSortOptions.PRIORITY,
            type: 0,
          },
        })
      );
    });
  });
});
