import {render} from 'sentry-test/reactTestingLibrary';

import ProjectReleaseDetails from './projectReleaseDetails';

describe('ProjectReleaseDetails', () => {
  it('should dislay if the release is using semver', () => {
    const organization = TestStubs.Organization({features: ['issue-release-semver']});
    const release = TestStubs.Release();
    const releaseMeta = TestStubs.ReleaseMeta();
    const {container} = render(
      <ProjectReleaseDetails
        projectSlug="project-slug"
        release={release}
        releaseMeta={releaseMeta}
      />,
      {organization}
    );

    expect(container).toHaveTextContent('SemverYes');
  });
});
