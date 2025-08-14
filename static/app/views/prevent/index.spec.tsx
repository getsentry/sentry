import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PreventPage from 'sentry/views/prevent';

const PREVENT_FEATURE = 'prevent-ai';

describe('PreventPage', () => {
  describe('when the user has access to the feature', () => {
    it('renders the passed children', () => {
      render(
        <PreventPage>
          <p>Test content</p>
        </PreventPage>,
        {organization: OrganizationFixture({features: [PREVENT_FEATURE]})}
      );

      const testContent = screen.getByText('Test content');
      expect(testContent).toBeInTheDocument();
    });
  });

  describe('when the user does not have access to the feature', () => {
    it('renders the NoAccess component', () => {
      render(
        <PreventPage>
          <p>Test content</p>
        </PreventPage>,
        {organization: OrganizationFixture({features: []})}
      );

      const noAccessText = screen.getByText("You don't have access to this feature");
      expect(noAccessText).toBeInTheDocument();
    });
  });
});
