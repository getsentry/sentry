import type {PropsWithChildren} from 'react';
import styled from '@emotion/styled';
import {ProjectFixture} from 'sentry-fixture/project';

import {render} from 'sentry-test/reactTestingLibrary';

import DiffModal from 'sentry/components/modals/diffModal';

describe('DiffModal', () => {
  it('renders', () => {
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
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/`,
      body: {features: []},
    });

    const styledWrapper = styled((c: PropsWithChildren) => c.children);

    render(
      <DiffModal
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
