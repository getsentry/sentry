import React from 'react';
import {mount} from 'enzyme';

import Feature from 'app/components/acl/feature';
import ConfigStore from 'app/stores/configStore';

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
      mount(
        <Feature features={['org-foo', 'project-foo']}>{childrenMock}</Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
      });
    });

    it('has features when requireAll is false', function() {
      mount(
        <Feature features={['org-foo', 'project-foo', 'apple']} requireAll={false}>
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
      });
    });

    it('has no features', function() {
      mount(<Feature features={['org-baz']}>{childrenMock}</Feature>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: false,
      });
    });

    it('calls render function when no features', function() {
      const noFeatureRenderer = jest.fn(() => null);
      mount(
        <Feature features={['org-baz']} renderNoFeatureMessage={noFeatureRenderer}>
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).not.toHaveBeenCalled();
      expect(noFeatureRenderer).toHaveBeenCalled();
    });

    it('can specify org from props', function() {
      mount(
        <Feature
          organization={TestStubs.Organization({features: ['org-bazar']})}
          features={['org-bazar']}
        >
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
      });
    });

    it('can specify project from props', function() {
      mount(
        <Feature
          project={TestStubs.Project({features: ['project-baz']})}
          features={['project-baz']}
        >
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: true,
      });
    });

    it('handles no org/project', function() {
      mount(
        <Feature organization={null} project={null} features={['org-foo', 'project-foo']}>
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: false,
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
      });

      mount(
        <Feature organization={organization} project={project} features={['project:bar']}>
          {childrenMock}
        </Feature>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasFeature: false,
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
      });
    });
  });

  describe('as React node', function() {
    let wrapper;

    it('has features', function() {
      wrapper = mount(
        <Feature features={['org-bar']}>
          <div>The Child</div>
        </Feature>,
        routerContext
      );

      expect(wrapper.find('Feature div').text()).toBe('The Child');
    });

    it('has no features', function() {
      wrapper = mount(
        <Feature features={['org-baz']}>
          <div>The Child</div>
        </Feature>,
        routerContext
      );

      expect(wrapper.find('Feature div')).toHaveLength(0);
    });
  });
});
