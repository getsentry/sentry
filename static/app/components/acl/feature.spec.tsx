import {Organization} from 'sentry-fixture/organization';
import {Project} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Feature from 'sentry/components/acl/feature';
import HookStore from 'sentry/stores/hookStore';

function HasFeatureContent() {
  return <p>Has access</p>;
}

describe('Feature', function () {
  describe('invalid props', () => {
    it('throws if neither is provided', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() =>
        // @ts-expect-error
        render(<Feature feature={undefined} anyOf={undefined} oneOf={undefined} />)
      ).toThrow(
        'Invalid feature props, neither feature nor allOf or oneOf is defined, got undefined'
      );
    });
  });

  describe('has feature', () => {
    describe('allOf', () => {
      it('has feature with org scope', () => {
        render(
          <Feature
            allOf={['organization:a', 'organization:b']}
            organization={Organization({features: ['organization:a', 'organization:b']})}
          >
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.getByText('Has access')).toBeInTheDocument();
      });
      it('has feature with project scope', () => {
        render(
          <Feature
            allOf={['project:a', 'project:b']}
            project={Project({features: ['project:a', 'project:b']})}
          >
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.getByText('Has access')).toBeInTheDocument();
      });
      it('has feature with no project scope', () => {
        render(
          <Feature allOf={['a', 'b']} project={Project({features: ['a', 'b']})}>
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.getByText('Has access')).toBeInTheDocument();
      });
      it('has feature with no org scope', () => {
        render(
          <Feature allOf={['a', 'b']} organization={Organization({features: ['a', 'b']})}>
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.getByText('Has access')).toBeInTheDocument();
      });
      it('has feature when list is empty', () => {
        render(
          <Feature
            allOf={[]}
            organization={Organization({features: ['organization:a', 'organization:b']})}
          >
            <HasFeatureContent />
          </Feature>
        );
      });
    });

    describe('oneOf', () => {
      it('has feature with org scope', () => {
        render(
          <Feature
            oneOf={['organization:a', 'organization:b']}
            organization={Organization({features: ['organization:a']})}
          >
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.getByText('Has access')).toBeInTheDocument();
      });
      it('has feature with project scope', () => {
        render(
          <Feature
            oneOf={['project:a', 'project:b']}
            project={Project({features: ['project:a']})}
          >
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.getByText('Has access')).toBeInTheDocument();
      });
      it('has feature with no project scope', () => {
        render(
          <Feature oneOf={['a', 'b']} project={Project({features: ['a', 'b']})}>
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.getByText('Has access')).toBeInTheDocument();
      });
      it('has feature with no org scope', () => {
        render(
          <Feature oneOf={['a', 'b']} organization={Organization({features: ['a', 'b']})}>
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.getByText('Has access')).toBeInTheDocument();
      });
      it('has feature when list is empty', () => {
        render(
          <Feature
            allOf={[]}
            organization={Organization({features: ['organization:a', 'organization:b']})}
          >
            <HasFeatureContent />
          </Feature>
        );
      });
    });

    describe('feature', () => {
      it('has feature with org scope', () => {
        render(
          <Feature
            feature="organization:a"
            organization={Organization({features: ['organization:a']})}
          >
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.getByText('Has access')).toBeInTheDocument();
      });
      it('has feature with project scope', () => {
        render(
          <Feature feature="project:a" project={Project({features: ['project:a']})}>
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.getByText('Has access')).toBeInTheDocument();
      });
      it('has feature with no project scope', () => {
        render(
          <Feature feature="a" project={Project({features: ['a', 'b']})}>
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.getByText('Has access')).toBeInTheDocument();
      });
      it('has feature with no org scope', () => {
        render(
          <Feature feature="a" organization={Organization({features: ['a', 'b']})}>
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.getByText('Has access')).toBeInTheDocument();
      });
    });
  });

  describe('does not have feature', () => {
    describe('allOf', () => {
      it('does not have feature without org scope', () => {
        render(
          <Feature
            allOf={['organization:a', 'organization:b']}
            organization={Organization({features: ['a', 'b']})}
          >
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.queryByText('Has access')).not.toBeInTheDocument();
      });
      it('does not have feature without project scope', () => {
        render(
          <Feature
            allOf={['project:a', 'project:b']}
            project={Project({features: ['a', 'b']})}
          >
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.queryByText('Has access')).not.toBeInTheDocument();
      });
      it('does not have feature without scope', () => {
        render(
          <Feature
            allOf={['feature']}
            organization={Organization({features: ['a', 'b']})}
          >
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.queryByText('Has access')).not.toBeInTheDocument();
      });
    });

    describe('oneOf', () => {
      it('does not have feature without org scope', () => {
        render(
          <Feature
            oneOf={['organization:a', 'organization:b']}
            organization={Organization({features: ['a', 'b']})}
          >
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.queryByText('Has access')).not.toBeInTheDocument();
      });
      it('does not have feature without project scope', () => {
        render(
          <Feature
            oneOf={['project:a', 'project:b']}
            project={Project({features: ['a', 'b']})}
          >
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.queryByText('Has access')).not.toBeInTheDocument();
      });
      it('does not have feature without scope', () => {
        render(
          <Feature
            oneOf={['feature']}
            organization={Organization({features: ['a', 'b']})}
          >
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.queryByText('Has access')).not.toBeInTheDocument();
      });
    });

    describe('feature', () => {
      it('does not have feature without org scope', () => {
        render(
          <Feature
            feature="organization:a"
            organization={Organization({features: ['a', 'b']})}
          >
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.queryByText('Has access')).not.toBeInTheDocument();
      });
      it('does not have feature without project scope', () => {
        render(
          <Feature feature="project:a" project={Project({features: ['a', 'b']})}>
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.queryByText('Has access')).not.toBeInTheDocument();
      });
      it('does not have feature without scope', () => {
        render(
          <Feature feature="feature" organization={Organization({features: ['a', 'b']})}>
            <HasFeatureContent />
          </Feature>
        );

        expect(screen.queryByText('Has access')).not.toBeInTheDocument();
      });
    });
  });

  describe('render prop', () => {
    it('has feature', () => {
      const mockRender = jest.fn(() => 'Has render prop access');
      render(
        <Feature
          feature="organization:a"
          project={Project({features: ['organization:a']})}
          organization={Organization({features: ['organization:a']})}
        >
          {mockRender}
        </Feature>
      );

      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          hasFeature: true,
          features: expect.arrayContaining(['organization:a']),
          organization: expect.anything(),
          project: expect.anything(),
        })
      );
      expect(screen.getByText('Has render prop access')).toBeInTheDocument();
    });
    it('does not have feature', () => {
      const mockRender = jest.fn(() => 'Has render prop access');
      render(
        <Feature
          feature="not-included"
          project={Project({features: ['organization:a']})}
          organization={Organization({features: ['organization:a']})}
        >
          {mockRender}
        </Feature>
      );

      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          hasFeature: false,
          features: expect.arrayContaining(['not-included']),
          organization: expect.anything(),
          project: expect.anything(),
        })
      );
    });
  });

  it('render via render function', () => {
    render(
      <Feature
        feature="organization:a"
        organization={Organization({features: ['organization:a']})}
      >
        {({hasFeature}) => <p>{hasFeature ? 'custom access' : 'no custom access'}</p>}
      </Feature>
    );

    expect(screen.getByText('custom access')).toBeInTheDocument();
  });
  it('renders coming soon if enabled via prop', () => {
    render(
      <Feature
        feature="not-included"
        organization={Organization({features: ['organization:a']})}
        renderDisabled
      >
        <HasFeatureContent />
      </Feature>
    );

    expect(screen.getByText('This feature is coming soon!')).toBeInTheDocument();
  });
  it('with custom renderDisabled', () => {
    render(
      <Feature
        feature="not-included"
        organization={Organization({features: ['organization:a']})}
        renderDisabled={() => <p>custom disabled</p>}
      >
        <HasFeatureContent />
      </Feature>
    );

    expect(screen.getByText('custom disabled')).toBeInTheDocument();
  });
  it('uses sentry hook to override renderDisabled', () => {
    HookStore.hooks = {
      'not-included-hook': [() => <p>hook content</p>],
    };
    render(
      <Feature
        feature="not-included-feature"
        // restricted to keyof hooks
        hookName={'not-included-hook' as any}
        organization={Organization({features: ['organization:a']})}
      >
        <HasFeatureContent />
      </Feature>
    );

    expect(screen.getByText('hook content')).toBeInTheDocument();
  });
});
