import {mountWithTheme} from 'sentry-test/enzyme';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import ModalStore from 'sentry/stores/modalStore';
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
    ConfigStore.init();
    jest.spyOn(ConfigStore, 'get').mockImplementation(() => []);
  });

  afterEach(() => {
    ConfigStore.teardown();
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

    it('can bookmark', async function () {
      render(
        <GroupActions
          group={group}
          project={project}
          organization={organization}
          disabled={false}
        />
      );

      userEvent.click(screen.getByLabelText('More Actions'));

      const bookmark = await screen.findByTestId('bookmark');
      userEvent.click(bookmark);

      expect(issuesApi).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {isBookmarked: true},
        })
      );
    });
  });

  describe('reprocessing', function () {
    it('renders ReprocessAction component if org has feature flag reprocessing-v2 and native exception event', async function () {
      const event = TestStubs.EventStacktraceException({
        platform: 'native',
      });

      render(
        <GroupActions
          group={group}
          project={project}
          organization={organization}
          event={event}
          disabled={false}
        />
      );

      userEvent.click(screen.getByLabelText('More Actions'));

      const reprocessActionButton = await screen.findByTestId('reprocess');
      expect(reprocessActionButton).toBeInTheDocument();
    });

    it('open dialog by clicking on the ReprocessAction component', async function () {
      const event = TestStubs.EventStacktraceException({
        platform: 'native',
      });

      render(
        <GroupActions
          group={group}
          project={project}
          organization={organization}
          event={event}
          disabled={false}
        />
      );

      const onReprocessEventFunc = jest.spyOn(ModalStore, 'openModal');

      userEvent.click(screen.getByLabelText('More Actions'));

      const reprocessActionButton = await screen.findByTestId('reprocess');
      expect(reprocessActionButton).toBeInTheDocument();
      userEvent.click(reprocessActionButton);
      await waitFor(() => expect(onReprocessEventFunc).toHaveBeenCalled());
    });
  });
});
