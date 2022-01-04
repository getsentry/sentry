import {lastOfArray} from 'sentry/utils';

import {Rect} from './gl/utils';
import {Profile} from './profile/profile';
import {CallTreeNode} from './callTreeNode';
import {FlamegraphFrame} from './flamegraphFrame';

export class Flamegraph {
  profile: Profile;
  frames: FlamegraphFrame[] = [];

  name: string;
  profileIndex: number;
  startedAt: number;
  endedAt: number;

  inverted?: boolean = false;
  leftHeavy?: boolean = false;

  colors: Map<string | number, number[]> | null = null;

  depth = 0;
  duration = 0;
  configSpace: Rect = new Rect(0, 0, 0, 0);

  constructor(
    profile: Profile,
    profileIndex: number,
    inverted = false,
    leftHeavy = false
  ) {
    this.inverted = inverted;
    this.leftHeavy = leftHeavy;
    this.profile = profile;

    this.duration = profile.duration;
    this.profileIndex = profileIndex;
    this.name = profile.name;

    this.startedAt = profile.startedAt;
    this.endedAt = profile.endedAt;

    this.frames = leftHeavy
      ? this.buildLeftHeavyGraph(profile)
      : this.buildCallOrderGraph(profile);

    if (this.frames.length) {
      this.configSpace = new Rect(0, 0, this.duration, this.depth);
    } else {
      // If we have no frames, set the trace duration to 1 second so that we can render a placeholder grid
      this.configSpace = new Rect(0, 0, 1_000_000, 0);
    }
  }

  static Empty(): Flamegraph {
    return new Flamegraph(
      new Profile(1_000_000, 0, 1_000_000, 'Profile', 'milliseconds'),
      0,
      false,
      false
    );
  }

  static From(from: Flamegraph, inverted = false, leftHeavy = false): Flamegraph {
    return new Flamegraph(from.profile, from.profileIndex, inverted, leftHeavy);
  }

  buildCallOrderGraph(profile: Profile): FlamegraphFrame[] {
    const frames: FlamegraphFrame[] = [];
    const stack: FlamegraphFrame[] = [];

    const openFrame = (node: CallTreeNode, value: number) => {
      const parent = lastOfArray(stack);

      const frame: FlamegraphFrame = {
        frame: node.frame,
        node,
        parent,
        children: [],
        depth: 0,
        start: value,
        end: value,
      };

      if (parent) {
        parent.children.push(frame);
      }

      stack.push(frame);
    };

    const closeFrame = (_: CallTreeNode, value: number) => {
      const stackTop = stack.pop();

      if (!stackTop) throw new Error('Unbalanced stack');

      stackTop.end = value;
      stackTop.depth = stack.length;
      frames.push(stackTop);

      if (stackTop.end - stackTop.start === 0) return;
      this.depth = Math.max(stackTop.depth, this.depth);
    };

    profile.forEach(openFrame, closeFrame);
    return frames;
  }

  buildLeftHeavyGraph(profile: Profile): FlamegraphFrame[] {
    const frames: FlamegraphFrame[] = [];
    const stack: FlamegraphFrame[] = [];

    const sortTree = (node: CallTreeNode) => {
      node.children.sort((a, b) => -(a.totalWeight - b.totalWeight));
      node.children.forEach(c => sortTree(c));
    };

    sortTree(profile.appendOrderTree);

    const openFrame = (node: CallTreeNode, value: number) => {
      const parent = lastOfArray(stack);
      const frame: FlamegraphFrame = {
        frame: node.frame,
        node,
        parent,
        children: [],
        depth: 0,
        start: value,
        end: value,
      };

      if (parent) {
        parent.children.push(frame);
      }

      stack.push(frame);
    };

    const closeFrame = (_node: CallTreeNode, value: number) => {
      const stackTop = stack.pop();

      if (!stackTop) throw new Error('Unbalanced stack');

      stackTop.end = value;
      stackTop.depth = stack.length;

      frames.push(stackTop);
      // Dont draw 0 width frames
      if (stackTop.end - stackTop.start === 0) return;

      this.depth = Math.max(stackTop.depth, this.depth);
    };

    function visit(node: CallTreeNode, start: number) {
      if (!node.frame.isRoot()) {
        openFrame(node, start);
      }

      let childTime = 0;

      node.children.forEach(child => {
        visit(child, start + childTime);
        childTime += child.totalWeight;
      });

      if (!node.frame.isRoot()) {
        closeFrame(node, start + node.totalWeight);
      }
    }
    visit(profile.appendOrderTree, 0);
    return frames;
  }

  setColors(colors: Map<string | number, number[]> | null): void {
    this.colors = colors;
  }

  withOffset(offset: number): Flamegraph {
    const mutateFrame = (frame: FlamegraphFrame) => {
      frame.start = offset + frame.start;
      frame.end = offset + frame.end;

      return frame;
    };

    const visit = (frame: FlamegraphFrame): void => {
      mutateFrame(frame);
    };

    for (const frame of this.frames) {
      visit(frame);
    }

    return this;
  }

  setConfigSpace(configSpace: Rect): Flamegraph {
    this.configSpace = configSpace;
    return this;
  }
}
