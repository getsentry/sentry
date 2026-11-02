import {expectTypeOf} from 'expect-type';
import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {registerOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import type {
  FeatureName,
  GlobalFeature,
  OrganizationFeature,
  ProjectFeature,
} from 'sentry/types/featureFlags.generated';

import {Feature} from './feature';

describe('Feature', () => {
  it('accepts only registered names in their corresponding scope', () => {
    expectTypeOf<'dashboards-import'>().toMatchTypeOf<OrganizationFeature>();
    expectTypeOf<'custom-inbound-filters'>().toMatchTypeOf<ProjectFeature>();
    expectTypeOf<'organizations:create'>().toMatchTypeOf<GlobalFeature>();
    expectTypeOf<'retired-feature'>().not.toMatchTypeOf<OrganizationFeature>();
    expectTypeOf<string>().not.toMatchTypeOf<OrganizationFeature>();
    expectTypeOf<'custom-inbound-filters'>().not.toMatchTypeOf<OrganizationFeature>();
    expectTypeOf<'dashboards-import'>().not.toMatchTypeOf<GlobalFeature>();
    expectTypeOf<'retired-feature'>().not.toMatchTypeOf<
      React.ComponentProps<typeof Feature>['features']
    >();
  });
  const organization = OrganizationFixture({
    features: ['dashboards-basic', 'dashboards-edit', 'advanced-search'],
  });
  const project = ProjectFixture({
    features: ['custom-inbound-filters', 'rate-limits'],
  });

  function WrappedFeature(props: React.ComponentProps<typeof Feature>) {
    return <Feature project={project} {...props} />;
  }

  describe('as render prop', () => {
    const childrenMock = jest.fn().mockReturnValue(null);
    beforeEach(() => {
      childrenMock.mockClear();
    });

    it('has features', () => {
      const features = [
        'dashboards-basic',
        'custom-inbound-filters',
      ] satisfies FeatureName[];

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

    it('has features when requireAll is false', () => {
      const features = [
        'dashboards-basic',
        'custom-inbound-filters',
        'data-forwarding',
      ] satisfies FeatureName[];

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

    it('has no features', () => {
      render(
        <WrappedFeature features="dashboards-import">{childrenMock}</WrappedFeature>,
        {
          organization,
        }
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: false,
        organization,
        project,
        features: ['dashboards-import'] satisfies FeatureName[],
        renderDisabled: false,
      });
    });

    it('calls render function when no features', () => {
      const noFeatureRenderer = jest.fn(() => null);
      render(
        <WrappedFeature features="dashboards-import" renderDisabled={noFeatureRenderer}>
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
        features: ['dashboards-import'] satisfies FeatureName[],
      });
    });

    it('can specify org from props', () => {
      const customOrg = OrganizationFixture({features: ['dashboards-starred']});
      render(
        <WrappedFeature organization={customOrg} features="dashboards-starred">
          {childrenMock}
        </WrappedFeature>,
        {organization}
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        organization: customOrg,
        project,
        features: ['dashboards-starred'] satisfies FeatureName[],
        renderDisabled: false,
      });
    });

    it('can specify project from props', () => {
      const customProject = ProjectFixture({features: ['discard-groups']});
      render(
        <WrappedFeature project={customProject} features="discard-groups">
          {childrenMock}
        </WrappedFeature>,
        {organization}
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        organization,
        project: customProject,
        features: ['discard-groups'] satisfies FeatureName[],
        renderDisabled: false,
      });
    });

    it('handles no org/project', () => {
      const features = [
        'dashboards-basic',
        'custom-inbound-filters',
      ] satisfies FeatureName[];
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

    it('handles features prefixed with org/project', () => {
      render(
        <WrappedFeature features="organizations:dashboards-edit">
          {childrenMock}
        </WrappedFeature>,
        {
          organization,
        }
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        organization,
        project,
        features: ['organizations:dashboards-edit'] satisfies FeatureName[],
        renderDisabled: false,
      });

      render(
        <WrappedFeature features="projects:releases">{childrenMock}</WrappedFeature>,
        {
          organization,
        }
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: false,
        organization,
        project,
        features: ['projects:releases'] satisfies FeatureName[],
        renderDisabled: false,
      });
    });

    it('checks ConfigStore.config.features (e.g. `organizations:create`)', () => {
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
        features: ['organizations:create'] satisfies FeatureName[],
        renderDisabled: false,
      });
    });
  });

  describe('no children', () => {
    it('should display renderDisabled with no feature', () => {
      render(
        <WrappedFeature
          features="data-forwarding"
          renderDisabled={() => <span>disabled</span>}
        >
          <div>The Child</div>
        </WrappedFeature>,
        {organization}
      );
      expect(screen.getByText('disabled')).toBeInTheDocument();
    });

    it('should display be empty when on', () => {
      render(
        <WrappedFeature
          features="dashboards-edit"
          renderDisabled={() => <span>disabled</span>}
        >
          <div>The Child</div>
        </WrappedFeature>,
        {organization}
      );
      expect(screen.queryByText('disabled')).not.toBeInTheDocument();
    });
  });

  describe('as React node', () => {
    it('has features', () => {
      render(
        <WrappedFeature features="dashboards-edit">
          <div>The Child</div>
        </WrappedFeature>,
        {organization}
      );

      expect(screen.getByText('The Child')).toBeInTheDocument();
    });

    it('has no features', () => {
      render(
        <WrappedFeature features="dashboards-import">
          <div>The Child</div>
        </WrappedFeature>,
        {organization}
      );

      expect(screen.queryByText('The Child')).not.toBeInTheDocument();
    });

    it('renders a default disabled component', () => {
      render(
        <WrappedFeature features="dashboards-import" renderDisabled>
          <div>The Child</div>
        </WrappedFeature>,
        {organization}
      );

      expect(screen.getByText('This feature is coming soon!')).toBeInTheDocument();
      expect(screen.queryByText('The Child')).not.toBeInTheDocument();
    });

    it('calls renderDisabled function when no features', () => {
      const noFeatureRenderer = jest.fn(() => null);
      const children = <div>The Child</div>;
      render(
        <WrappedFeature features="dashboards-import" renderDisabled={noFeatureRenderer}>
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
        features: ['dashboards-import'] satisfies FeatureName[],
      });
    });
  });

  describe('using override registry for renderDisabled', () => {
    let overrideFn: jest.Mock;

    beforeEach(() => {
      overrideFn = jest.fn(() => null);
      registerOverride('feature-disabled:sso-basic', overrideFn);
    });

    it('uses overrideName if provided', () => {
      const children = <div>The Child</div>;
      render(
        <WrappedFeature
          features="dashboards-starred"
          overrideName="feature-disabled:sso-basic"
        >
          {children}
        </WrappedFeature>,
        {organization}
      );

      expect(screen.queryByText('The Child')).not.toBeInTheDocument();

      expect(overrideFn).toHaveBeenCalledWith({
        hasFeature: false,
        children,
        organization,
        project,
        features: ['dashboards-starred'] satisfies FeatureName[],
      });
    });
  });
});
