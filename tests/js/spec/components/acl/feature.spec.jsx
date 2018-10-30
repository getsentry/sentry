import React from 'react';
import {mount} from 'enzyme';

import Feature from 'app/components/acl/feature';
import ConfigStore from 'app/stores/configStore';
import HookStore from 'app/stores/hookStore';

describe('Feature', function() {
  const organization = TestStubs.Organization({
    features: ['org-foo', 'org-bar', 'bar'],
  });
  const project = TestStubs.Project({
    features: ['project-foo', 'project-bar'],
  });
  const routerContext = TestStubs.routerContext([
    {
      organization,
      project,
    },
  ]);

  describe('as render prop', function() {
    let childrenMock = jest.fn().mockReturnValue(null);
    beforeEach(function() {
      childrenMock.mockClear();
    });

    it('has features', function() {
      const features = ['org-foo', 'project-foo'];

      mount(<Feature features={features}>{childrenMock}</Feature>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        renderDisabled: false,
        features,
        organization,
        project,
      });
    });

    it('has features when requireAll is false', function() {
      const features = ['org-foo', 'project-foo', 'apple'];

      mount(
        <Feature features={features} requireAll={false}>
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        renderDisabled: false,
        organization,
        project,
        features,
      });
    });

    it('has no features', function() {
      mount(<Feature features={['org-baz']}>{childrenMock}</Feature>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: false,
        renderDisabled: false,
        organization,
        project,
        features: ['org-baz'],
      });
    });

    it('calls render function when no features', function() {
      const noFeatureRenderer = jest.fn(() => null);
      mount(
        <Feature features={['org-baz']} renderDisabled={noFeatureRenderer}>
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).not.toHaveBeenCalled();
      expect(noFeatureRenderer).toHaveBeenCalledWith({
        hasFeature: false,
        children: childrenMock,
        renderDisabled: noFeatureRenderer,
        organization,
        project,
        features: ['org-baz'],
      });
    });

    it('can specify org from props', function() {
      const customOrg = TestStubs.Organization({features: ['org-bazar']});
      mount(
        <Feature organization={customOrg} features={['org-bazar']}>
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        renderDisabled: false,
        organization: customOrg,
        project,
        features: ['org-bazar'],
      });
    });

    it('can specify project from props', function() {
      const customProject = TestStubs.Project({features: ['project-baz']});
      mount(
        <Feature project={customProject} features={['project-baz']}>
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        renderDisabled: false,
        organization,
        project: customProject,
        features: ['project-baz'],
      });
    });

    it('handles no org/project', function() {
      const features = ['org-foo', 'project-foo'];
      mount(
        <Feature organization={null} project={null} features={features}>
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: false,
        renderDisabled: false,
        organization: null,
        project: null,
        features,
      });
    });

    it('handles features prefixed with org/project', function() {
      mount(
        <Feature
          organization={organization}
          project={project}
          features={['organization:bar']}
        >
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        renderDisabled: false,
        organization,
        project,
        features: ['organization:bar'],
      });

      mount(
        <Feature organization={organization} project={project} features={['project:bar']}>
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: false,
        renderDisabled: false,
        organization,
        project,
        features: ['project:bar'],
      });
    });

    it('checks ConfigStore.config.features (e.g. `organizations:create`)', function() {
      ConfigStore.config = {
        features: new Set(['organizations:create']),
      };
      mount(
        <Feature features={['organizations:create']}>{childrenMock}</Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
        renderDisabled: false,
        organization,
        project,
        features: ['organizations:create'],
      });
    });
  });

  describe('as React node', function() {
    it('has features', function() {
      const wrapper = mount(
        <Feature features={['org-bar']}>
          <div>The Child</div>
        </Feature>,
        routerContext
      );

      expect(wrapper.find('Feature div').text()).toBe('The Child');
    });

    it('has no features', function() {
      const wrapper = mount(
        <Feature features={['org-baz']}>
          <div>The Child</div>
        </Feature>,
        routerContext
      );

      expect(wrapper.find('Feature div')).toHaveLength(0);
    });

    it('renders a default disabled component', function() {
      const wrapper = mount(
        <Feature features={['org-baz']} renderDisabled>
          <div>The Child</div>
        </Feature>,
        routerContext
      );

      expect(wrapper.exists('ComingSoon')).toBe(true);
      expect(wrapper.exists('Feature div[children="The Child"]')).not.toBe(true);
    });

    it('calls renderDisabled function when no features', function() {
      const noFeatureRenderer = jest.fn(() => null);
      const children = <div>The Child</div>;
      const wrapper = mount(
        <Feature features={['org-baz']} renderDisabled={noFeatureRenderer}>
          {children}
        </Feature>,
        routerContext
      );

      expect(wrapper.find('Feature div')).toHaveLength(0);
      expect(noFeatureRenderer).toHaveBeenCalledWith({
        hasFeature: false,
        renderDisabled: noFeatureRenderer,
        children,
        organization,
        project,
        features: ['org-baz'],
      });
    });
  });

  describe('using HookStore for renderDisabled', function() {
    let hookFn;

    beforeEach(function() {
      hookFn = jest.fn(() => null);
      HookStore.hooks['feature-disabled:org-baz'] = [hookFn];
    });

    afterEach(function() {
      delete HookStore.hooks['feature-disabled:org-baz'];
    });

    it('calls renderDisabled function from HookStore when no features', function() {
      const noFeatureRenderer = jest.fn(() => null);
      const children = <div>The Child</div>;
      const wrapper = mount(
        <Feature features={['org-baz']} renderDisabled={noFeatureRenderer}>
          {children}
        </Feature>,
        routerContext
      );

      expect(wrapper.find('Feature div')).toHaveLength(0);
      expect(noFeatureRenderer).not.toHaveBeenCalled();

      expect(hookFn).toHaveBeenCalledWith({
        hasFeature: false,
        renderDisabled: hookFn,
        children,
        organization,
        project,
        features: ['org-baz'],
      });
    });

    it('does not check hook store for multiple features', function() {
      const noFeatureRenderer = jest.fn(() => null);
      const wrapper = mount(
        <Feature features={['org-baz', 'org-bazar']} renderDisabled={noFeatureRenderer}>
          <div>The Child</div>
        </Feature>,
        routerContext
      );

      expect(wrapper.find('Feature div')).toHaveLength(0);
      expect(hookFn).not.toHaveBeenCalled();
      expect(noFeatureRenderer).toHaveBeenCalled();
    });
  });
});
