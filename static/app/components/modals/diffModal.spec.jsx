import {render} from 'sentry-test/reactTestingLibrary';

import DiffModal from 'sentry/components/modals/diffModal';

describe('DiffModal', function () {
  it('renders', function () {
    const project = TestStubs.ProjectDetails();
    MockApiClient.addMockResponse({
      url: '/issues/123/events/latest/',
      body: {
        eventID: '456',
      },
    });
    MockApiClient.addMockResponse({
      url: '/projects/123/project-slug/events/456/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/issues/234/events/latest/',
      body: {
        eventID: '789',
      },
    });
    MockApiClient.addMockResponse({
      url: '/projects/123/project-slug/events/789/',
      body: [],
    });

    render(
      <DiffModal
        orgId="123"
        baseIssueId="123"
        targetIssueId="234"
        project={project}
        Body={({children}) => <div>{children}</div>}
        CloseButton={({children}) => <div>{children}</div>}
      />
    );
  });
});
