import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Feature from 'sentry/components/acl/feature';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {ProjectContext} from 'sentry/views/projects/projectContext';

describe('Feature', function () {
  const organization = OrganizationFixture({
    features: ['org-foo', 'org-bar', 'bar'],
  });
  const project = ProjectFixture({
    features: ['project-foo', 'project-bar'],
  });

  function WrappedFeature(props: React.ComponentProps<typeof Feature>) {
    return (
      <ProjectContext.Provider value={project}>
        <Feature {...props} />
      </ProjectContext.Provider>
    );
  }

  describe('as render prop', function () {
    const childrenMock = jest.fn().mockReturnValue(null);
    beforeEach(function () {
      childrenMock.mockClear();
    });

    it('has features', function () {
      const features = ['org-foo', 'project-foo'];

      render(<WrappedFeature features={features}>{childrenMock}</WrappedFeature>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        features,
        organization,
        project,
        renderDisabled: false,
      });
    });

    it('has features when requireAll is false', function () {
      const features = ['org-foo', 'project-foo', 'apple'];

      render(
        <WrappedFeature features={features} requireAll={false}>
          {childrenMock}
        </WrappedFeature>,
        {organization}
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        organization,
        project,
        features,
        renderDisabled: false,
      });
    });

    it('has no features', function () {
      render(<WrappedFeature features="org-baz">{childrenMock}</WrappedFeature>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: false,
        organization,
        project,
        features: ['org-baz'],
        renderDisabled: false,
      });
    });

    it('calls render function when no features', function () {
      const noFeatureRenderer = jest.fn(() => null);
      render(
        <WrappedFeature features="org-baz" renderDisabled={noFeatureRenderer}>
          {childrenMock}
        </WrappedFeature>,
        {organization}
      );

      expect(childrenMock).not.toHaveBeenCalled();
      expect(noFeatureRenderer).toHaveBeenCalledWith({
        hasFeature: false,
        children: childrenMock,
        organization,
        project,
        features: ['org-baz'],
      });
    });

    it('can specify org from props', function () {
      const customOrg = OrganizationFixture({features: ['org-bazar']});
      render(
        <WrappedFeature organization={customOrg} features="org-bazar">
          {childrenMock}
        </WrappedFeature>,
        {organization}
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        organization: customOrg,
        project,
        features: ['org-bazar'],
        renderDisabled: false,
      });
    });

    it('can specify project from props', function () {
      const customProject = ProjectFixture({features: ['project-baz']});
      render(
        <WrappedFeature project={customProject} features="project-baz">
          {childrenMock}
        </WrappedFeature>,
        {organization}
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        organization,
        project: customProject,
        features: ['project-baz'],
        renderDisabled: false,
      });
    });

    it('handles no org/project', function () {
      const features = ['org-foo', 'project-foo'];
      render(<WrappedFeature features={features}>{childrenMock}</WrappedFeature>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasFeature: true,
          organization,
          project,
          features,
          renderDisabled: false,
        })
      );
    });

    it('handles features prefixed with org/project', function () {
      render(
        <WrappedFeature features="organizations:org-bar">{childrenMock}</WrappedFeature>,
        {
          organization,
        }
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        organization,
        project,
        features: ['organizations:org-bar'],
        renderDisabled: false,
      });

      render(<WrappedFeature features="projects:bar">{childrenMock}</WrappedFeature>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: false,
        organization,
        project,
        features: ['projects:bar'],
        renderDisabled: false,
      });
    });

    it('checks ConfigStore.config.features (e.g. `organizations:create`)', function () {
      ConfigStore.loadInitialData(
        ConfigFixture({
          features: new Set(['organizations:create']),
        })
      );

      render(
        <WrappedFeature features="organizations:create">{childrenMock}</WrappedFeature>,
        {
          organization,
        }
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        organization,
        project,
        features: ['organizations:create'],
        renderDisabled: false,
      });
    });
  });

  describe('no children', function () {
    it('should display renderDisabled with no feature', function () {
      render(
        <WrappedFeature features="nope" renderDisabled={() => <span>disabled</span>}>
          <div>The Child</div>
        </WrappedFeature>,
        {organization}
      );
      expect(screen.getByText('disabled')).toBeInTheDocument();
    });

    it('should display be empty when on', function () {
      render(
        <WrappedFeature features="org-bar" renderDisabled={() => <span>disabled</span>}>
          <div>The Child</div>
        </WrappedFeature>,
        {organization}
      );
      expect(screen.queryByText('disabled')).not.toBeInTheDocument();
    });
  });

  describe('as React node', function () {
    it('has features', function () {
      render(
        <WrappedFeature features="org-bar">
          <div>The Child</div>
        </WrappedFeature>,
        {organization}
      );

      expect(screen.getByText('The Child')).toBeInTheDocument();
    });

    it('has no features', function () {
      render(
        <WrappedFeature features="org-baz">
          <div>The Child</div>
        </WrappedFeature>,
        {organization}
      );

      expect(screen.queryByText('The Child')).not.toBeInTheDocument();
    });

    it('renders a default disabled component', function () {
      render(
        <WrappedFeature features="org-baz" renderDisabled>
          <div>The Child</div>
        </WrappedFeature>,
        {organization}
      );

      expect(screen.getByText('This feature is coming soon!')).toBeInTheDocument();
      expect(screen.queryByText('The Child')).not.toBeInTheDocument();
    });

    it('calls renderDisabled function when no features', function () {
      const noFeatureRenderer = jest.fn(() => null);
      const children = <div>The Child</div>;
      render(
        <WrappedFeature features="org-baz" renderDisabled={noFeatureRenderer}>
          {children}
        </WrappedFeature>,
        {organization}
      );

      expect(screen.queryByText('The Child')).not.toBeInTheDocument();

      expect(noFeatureRenderer).toHaveBeenCalledWith({
        hasFeature: false,
        children,
        organization,
        project,
        features: ['org-baz'],
      });
    });
  });

  describe('using HookStore for renderDisabled', function () {
    let hookFn: jest.Mock;

    beforeEach(function () {
      hookFn = jest.fn(() => null);
      HookStore.add('feature-disabled:sso-basic', hookFn);
    });

    afterEach(function () {
      HookStore.remove('feature-disabled:sso-basic', hookFn);
    });

    it('uses hookName if provided', function () {
      const children = <div>The Child</div>;
      render(
        <WrappedFeature features="org-bazar" hookName="feature-disabled:sso-basic">
          {children}
        </WrappedFeature>,
        {organization}
      );

      expect(screen.queryByText('The Child')).not.toBeInTheDocument();

      expect(hookFn).toHaveBeenCalledWith({
        hasFeature: false,
        children,
        organization,
        project,
        features: ['org-bazar'],
      });
    });
  });
});
