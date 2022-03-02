import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Frame} from 'sentry/utils/profiling/frame';
import {Profile} from 'sentry/utils/profiling/profile/profile';

// Test utils to keep the tests code dry
export const f = (name: string, key: number) =>
  new Frame({name, key, is_application: false});
export const c = (fr: Frame) => new CallTreeNode(fr, null);
export const firstCallee = (node: CallTreeNode) => node.children[0];
export const nthCallee = (node: CallTreeNode, n: number) => node.children[n];

export const makeTestingBoilerplate = () => {
  const timings: [Frame['name'], string][] = [];

  const openSpy = jest.fn();
  const closeSpy = jest.fn();

  // We need to wrap the spy fn because they are not allowed to reference external variables
  const open = (node, value) => {
    timings.push([node.frame.name, 'open']);
    openSpy(node, value);
  };
  // We need to wrap the spy fn because they are not allowed to reference external variables
  const close = (node, val) => {
    timings.push([node.frame.name, 'close']);
    closeSpy(node, val);
  };

  return {open, close, timings, openSpy, closeSpy};
};

// Since it's easy to make mistakes or accidentally assign parents to the wrong nodes, this utility fn
// will format the stack samples as a tree string so it's more human friendly.
// @ts-ignore this is a helper fn
export const _logExpectedStack = (samples: Profile['samples']): string => {
  const head = `
Samples follow a top-down chronological order\n\n`;

  const tail = `\n
----------------------->
stack top -> stack bottom`;

  const final: string[] = [];

  const visit = (node: CallTreeNode, str: string[]) => {
    str.push(`${node.frame.name}`);

    if (node.parent) {
      visit(node.parent, str);
    }
  };

  for (const stackTop of samples) {
    const str = [];
    visit(stackTop, str);

    final.push(str.join(' -> '));
  }

  return `${head}${final.join('\n')}${tail}`;
};

describe('Profile', () => {
  it('Empty profile duration is not infinity', () => {
    const profile = Profile.Empty();
    expect(profile.duration).toEqual(100_000);
    expect(profile.minFrameDuration).toEqual(100_000);
  });

  it('forEach - iterates over a single sample', () => {
    const profile = new Profile(1000, 0, 1000, 'profile', 'ms');

    // Frames
    const f0 = f('f0', 0);
    const f1 = f('f1', 1);

    // Call tree nodes
    const s0 = c(f0);
    const s1 = c(f1);
    s0.parent = s1;

    profile.samples = [s0];

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();
    profile.forEach(open, close);

    expect(timings).toEqual([
      ['f1', 'open'],
      ['f0', 'open'],
      ['f0', 'close'],
      ['f1', 'close'],
    ]);

    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(closeSpy).toHaveBeenCalledTimes(2);
  });

  it('forEach - opens new frames when stack is shared', () => {
    const profile = new Profile(1000, 0, 1000, 'profile', 'ms');

    // Frames
    const f0 = f('f0', 0);
    const f1 = f('f1', 1);
    const f2 = f('f2', 1);

    // Call tree nodes
    const s0 = c(f0);
    const s1 = c(f1);
    const s2 = c(f2);

    s1.parent = s0;
    s2.parent = s1;

    profile.samples = [s0, s1, s2];

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();
    profile.forEach(open, close);

    expect(timings).toEqual([
      ['f0', 'open'],
      ['f1', 'open'],
      ['f2', 'open'],
      ['f2', 'close'],
      ['f1', 'close'],
      ['f0', 'close'],
    ]);

    expect(openSpy).toHaveBeenCalledTimes(3);
    expect(closeSpy).toHaveBeenCalledTimes(3);
  });

  it('forEach - closes frames one by one when stack is shared', () => {
    const profile = new Profile(1000, 0, 1000, 'profile', 'ms');

    // Instantiate frames
    const f0 = f('f0', 0);
    const f1 = f('f1', 1);
    const f2 = f('f2', 2);

    // Instantiate call tree nodes
    const s0 = c(f2);
    const s1 = c(f1);
    const s2 = c(f0);

    profile.samples = [s0, s1, s2];

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();
    profile.forEach(open, close);

    expect(timings).toEqual([
      ['f2', 'open'],
      ['f2', 'close'],
      ['f1', 'open'],
      ['f1', 'close'],
      ['f0', 'open'],
      ['f0', 'close'],
    ]);

    expect(openSpy).toHaveBeenCalledTimes(3);
    expect(closeSpy).toHaveBeenCalledTimes(3);
  });

  // In JS land, the stack can be idle which is not the case in other runtimes, e.g. in mobile
  //  the program main is always running, so make sure we support "holes" in the samples
  it('forEach - supports an idle stack', () => {
    const profile = new Profile(1000, 0, 1000, 'profile', 'ms');

    // Instantiate frames
    const f0 = f('f0', 0);

    // Instantiate call tree nodes
    const s0 = c(f0);
    const s1 = c(Frame.Root);

    profile.samples = [s0, s1, s0];

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();
    profile.forEach(open, close);

    expect(timings).toEqual([
      ['f0', 'open'],
      ['f0', 'close'],
      ['f0', 'open'],
      ['f0', 'close'],
    ]);

    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(closeSpy).toHaveBeenCalledTimes(2);
  });
});
