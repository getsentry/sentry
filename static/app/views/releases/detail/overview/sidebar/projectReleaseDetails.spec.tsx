import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseMetaFixture} from 'sentry-fixture/releaseMeta';

import {render} from 'sentry-test/reactTestingLibrary';

import ProjectReleaseDetails from './projectReleaseDetails';

describe('ProjectReleaseDetails', () => {
  it('should dislay if the release is using semver', () => {
    const release = ReleaseFixture();
    const releaseMeta = ReleaseMetaFixture();
    const {container} = render(
      <ProjectReleaseDetails
        projectSlug="project-slug"
        release={release}
        releaseMeta={releaseMeta}
      />
    );

    expect(container).toHaveTextContent('SemverYes');
  });
});
