import {render} from 'sentry-test/reactTestingLibrary';

import DiffModal from 'sentry/components/modals/diffModal';

describe('DiffModal', function () {
  it('renders', function () {
    const project = TestStubs.ProjectDetails();

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
