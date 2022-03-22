import {mountWithTheme} from 'sentry-test/enzyme';

import ModalActions from 'sentry/actions/modalActions';
import ConfigStore from 'sentry/stores/configStore';
import {Event} from 'sentry/types/event';
import GroupActions from 'sentry/views/organizationGroupDetails/actions';

const group = TestStubs.Group({
  id: '1337',
  pluginActions: [],
  pluginIssues: [],
});

const project = TestStubs.ProjectDetails({
  id: '2448',
  name: 'project name',
  slug: 'project',
});

const organization = TestStubs.Organization({
  id: '4660',
  slug: 'org',
  features: ['reprocessing-v2'],
});

function renderComponent(event?: Event) {
  return mountWithTheme(
    <GroupActions
      group={group}
      project={project}
      organization={organization}
      event={event}
      disabled={false}
    />
  );
}

describe('GroupActions', function () {
  beforeEach(function () {
    jest.spyOn(ConfigStore, 'get').mockImplementation(() => []);
  });

  describe('render()', function () {
    it('renders correctly', function () {
      const wrapper = renderComponent();
      expect(wrapper).toSnapshot();
    });
  });

  describe('subscribing', function () {
    let issuesApi: any;
    beforeEach(function () {
      issuesApi = MockApiClient.addMockResponse({
        url: '/projects/org/project/issues/',
        method: 'PUT',
        body: TestStubs.Group({isSubscribed: false}),
      });
    });

    it('can subscribe', function () {
      const wrapper = renderComponent();
      const btn = wrapper.find('button[aria-label="Subscribe"]');
      btn.simulate('click');

      expect(issuesApi).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {isSubscribed: true},
        })
      );
    });
  });

  describe('bookmarking', function () {
    let issuesApi: any;
    beforeEach(function () {
      issuesApi = MockApiClient.addMockResponse({
        url: '/projects/org/project/issues/',
        method: 'PUT',
        body: TestStubs.Group({isBookmarked: false}),
      });
    });

    it('can bookmark', function () {
      const wrapper = renderComponent();
      const btn = wrapper.find('button[aria-label="Bookmark"]');
      btn.simulate('click');

      expect(issuesApi).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {isBookmarked: true},
        })
      );
    });
  });

  describe('reprocessing', function () {
    it('renders ReprocessAction component if org has feature flag reprocessing-v2', function () {
      const wrapper = renderComponent();

      const reprocessActionButton = wrapper.find('ReprocessAction button');
      expect(reprocessActionButton).toBeTruthy();
    });

    it('open dialog by clicking on the ReprocessAction component', async function () {
      const event = TestStubs.EventStacktraceException({
        platform: 'native',
      });

      const onReprocessEventFunc = jest.spyOn(ModalActions, 'openModal');

      const wrapper = renderComponent(event);

      const reprocessActionButton = wrapper.find('ReprocessAction button');
      expect(reprocessActionButton).toBeTruthy();

      reprocessActionButton.simulate('click');

      await tick();

      expect(onReprocessEventFunc).toHaveBeenCalled();
    });
  });
});
