import styled from '@emotion/styled';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render} from 'sentry-test/reactTestingLibrary';

import DiffModal from 'sentry/components/modals/diffModal';

describe('DiffModal', function () {
  it('renders', function () {
    const project = ProjectFixture();
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

    const styledWrapper = styled(c => c.children);

    render(
      <DiffModal
        orgId="123"
        baseIssueId="123"
        targetIssueId="234"
        project={project}
        Footer={styledWrapper()}
        Body={styledWrapper()}
        Header={c => <span>{c.children}</span>}
        CloseButton={({children}) => <div>{children}</div>}
        closeModal={() => {}}
      />
    );
  });
});
