import {lastOfArray} from 'sentry/utils';

import {Rect} from './gl/utils';
import {Profile} from './profile/profile';
import {makeFormatter, makeTimelineFormatter} from './units/units';
import {CallTreeNode} from './callTreeNode';
import {FlamegraphFrame} from './flamegraphFrame';

export class Flamegraph {
  profile: Profile;
  frames: FlamegraphFrame[] = [];
  roots: FlamegraphFrame[] = [];

  profileIndex: number;

  inverted?: boolean = false;
  leftHeavy?: boolean = false;

  depth = 0;
  configSpace: Rect = new Rect(0, 0, 0, 0);

  formatter: (value: number) => string;
  timelineFormatter: (value: number) => string;

  frameIndex: Record<string, FlamegraphFrame> = {};

  static Empty(): Flamegraph {
    return new Flamegraph(Profile.Empty(), 0, {
      inverted: false,
      leftHeavy: false,
    });
  }

  static From(from: Flamegraph, {inverted = false, leftHeavy = false}): Flamegraph {
    return new Flamegraph(from.profile, from.profileIndex, {inverted, leftHeavy});
  }

  constructor(
    profile: Profile,
    profileIndex: number,
    {
      inverted = false,
      leftHeavy = false,
      configSpace,
    }: {configSpace?: Rect; inverted?: boolean; leftHeavy?: boolean} = {}
  ) {
    this.inverted = inverted;
    this.leftHeavy = leftHeavy;

    // @TODO check if we can get rid of this profile reference
    this.profile = profile;
    this.profileIndex = profileIndex;

    this.roots = [];

    // If a custom config space is provided, use it and draw the chart in it
    this.frames = leftHeavy
      ? this.buildLeftHeavyGraph(profile, configSpace ? configSpace.x : 0)
      : this.buildCallOrderGraph(profile, configSpace ? configSpace.x : 0);

    this.formatter = makeFormatter(profile.unit);
    this.timelineFormatter = makeTimelineFormatter(profile.unit);

    // If the profile duration is 0, set the flamegraph duration
    // to 1 second so we can render a placeholder grid
    this.configSpace = new Rect(
      0,
      0,
      this.profile.unit === 'microseconds'
        ? 1e6
        : this.profile.unit === 'milliseconds'
        ? 1e3
        : 1,
      this.depth
    );

    if (this.profile.duration) {
      this.configSpace = new Rect(
        configSpace ? configSpace.x : this.profile.startedAt,
        0,
        configSpace ? configSpace.width : this.profile.duration,
        this.depth
      );
    }
  }

  buildCallOrderGraph(profile: Profile, offset: number): FlamegraphFrame[] {
    const frames: FlamegraphFrame[] = [];
    const stack: FlamegraphFrame[] = [];

    let idx = 0;

    const openFrame = (node: CallTreeNode, value: number) => {
      const parent = lastOfArray(stack);

      const frame: FlamegraphFrame = {
        key: idx,
        frame: node.frame,
        node,
        parent,
        children: [],
        depth: 0,
        start: offset + value,
        end: offset + value,
      };

      if (parent) {
        parent.children.push(frame);
      }

      stack.push(frame);

      if (stack.length === 1) {
        this.roots.push(frame);
      }
      idx++;
    };

    const closeFrame = (_: CallTreeNode, value: number) => {
      const stackTop = stack.pop();

      if (!stackTop) {
        // This is unreachable because the profile importing logic already checks this
        throw new Error('Unbalanced stack');
      }

      stackTop.end = offset + value;
      stackTop.depth = stack.length;

      if (stackTop.end - stackTop.start === 0) {
        return;
      }

      frames.unshift(stackTop);
      this.depth = Math.max(stackTop.depth, this.depth);
    };

    profile.forEach(openFrame, closeFrame);
    return frames;
  }

  buildLeftHeavyGraph(profile: Profile, offset: number): FlamegraphFrame[] {
    const frames: FlamegraphFrame[] = [];
    const stack: FlamegraphFrame[] = [];

    const sortTree = (node: CallTreeNode) => {
      node.children.sort((a, b) => -(a.totalWeight - b.totalWeight));
      node.children.forEach(c => sortTree(c));
    };

    sortTree(profile.appendOrderTree);

    let idx = 0;
    const openFrame = (node: CallTreeNode, value: number) => {
      const parent = lastOfArray(stack);
      const frame: FlamegraphFrame = {
        key: idx,
        frame: node.frame,
        node,
        parent,
        children: [],
        depth: 0,
        start: offset + value,
        end: offset + value,
      };

      if (parent) {
        parent.children.push(frame);
      }

      stack.push(frame);

      if (stack.length === 1) {
        this.roots.push(frame);
      }
      idx++;
    };

    const closeFrame = (_node: CallTreeNode, value: number) => {
      const stackTop = stack.pop();

      if (!stackTop) {
        throw new Error('Unbalanced stack');
      }

      stackTop.end = offset + value;
      stackTop.depth = stack.length;

      // Dont draw 0 width frames
      if (stackTop.end - stackTop.start === 0) {
        return;
      }
      frames.unshift(stackTop);
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

  setConfigSpace(configSpace: Rect): Flamegraph {
    this.configSpace = configSpace;
    return this;
  }
}
