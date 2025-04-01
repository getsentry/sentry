import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PipelinePage from 'sentry/views/pipeline';

const COVERAGE_FEATURE = 'codecov-ui';

describe('PipelinePage', () => {
  describe('when the user has access to the feature', () => {
    it('renders the passed children', () => {
      render(
        <PipelinePage>
          <p>Test content</p>
        </PipelinePage>,
        {organization: OrganizationFixture({features: [COVERAGE_FEATURE]})}
      );

      const testContent = screen.getByText('Test content');
      expect(testContent).toBeInTheDocument();
    });
  });

  describe('when the user does not have access to the feature', () => {
    it('renders the NoAccess component', () => {
      render(
        <PipelinePage>
          <p>Test content</p>
        </PipelinePage>,
        {organization: OrganizationFixture({features: []})}
      );

      const noAccessText = screen.getByText("You don't have access to this feature");
      expect(noAccessText).toBeInTheDocument();
    });
  });
});
