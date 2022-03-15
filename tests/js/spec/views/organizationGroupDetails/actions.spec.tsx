import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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
  return render(
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
      const {container} = renderComponent();
      expect(container).toSnapshot();
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
      renderComponent();
      const subscribe = screen.getByLabelText('Subscribe');
      userEvent.click(subscribe);

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
      renderComponent();
      const subscribe = screen.getByLabelText('Bookmark');
      userEvent.click(subscribe);

      expect(issuesApi).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {isBookmarked: true},
        })
      );
    });
  });

  describe('reprocessing', function () {
    it('renders ReprocessAction component if org has feature flag reprocessing-v2', async function () {
      const event = TestStubs.EventStacktraceException({
        platform: 'native',
      });

      renderComponent(event);
      expect(await screen.findByLabelText('Reprocess this issue')).toBeInTheDocument();
    });

    it('open dialog by clicking on the ReprocessAction component', async function () {
      const event = TestStubs.EventStacktraceException({
        platform: 'native',
      });

      const onReprocessEventFunc = jest.spyOn(ModalActions, 'openModal');

      renderComponent(event);
      const btn = await screen.findByLabelText('Reprocess this issue');
      expect(btn).toBeInTheDocument();

      // Skip hover to avoid the delayed tooltip from trying to render (it will
      // happen outside of the RTL work loop)
      userEvent.click(btn, undefined, {skipHover: true});

      await waitFor(() => expect(onReprocessEventFunc).toHaveBeenCalled());
    });
  });
});
