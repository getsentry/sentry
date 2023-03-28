import {lastOfArray} from 'sentry/utils';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

import {Profile} from './profile/profile';
import {SampledProfile} from './profile/sampledProfile';
import {makeFormatter, makeTimelineFormatter} from './units/units';
import {CallTreeNode} from './callTreeNode';
import {Frame} from './frame';
import {Rect} from './speedscope';

function sortByTotalWeight(a: CallTreeNode, b: CallTreeNode) {
  return b.totalWeight - a.totalWeight;
}

function sortAlphabetically(a: CallTreeNode, b: CallTreeNode) {
  return a.frame.name.localeCompare(b.frame.name);
}

function makeTreeSort(sortFn: (a: CallTreeNode, b: CallTreeNode) => number) {
  return (root: CallTreeNode) => {
    const queue: CallTreeNode[] = [root];

    while (queue.length > 0) {
      const next = queue.pop()!;

      next.children.sort(sortFn);

      for (let i = 0; i < next.children.length; i++) {
        queue.push(next.children[i]);
      }
    }
  };
}

const alphabeticTreeSort = makeTreeSort(sortAlphabetically);
const leftHeavyTreeSort = makeTreeSort(sortByTotalWeight);

export class Flamegraph {
  profile: Profile;
  frames: ReadonlyArray<FlamegraphFrame> = [];
  profileIndex: number;

  inverted: boolean = false;
  sort: 'left heavy' | 'alphabetical' | 'call order' = 'call order';

  depth = 0;
  configSpace: Rect = Rect.Empty();
  root: FlamegraphFrame = {
    key: -1,
    parent: null,
    frame: new Frame({...Frame.Root}),
    node: new CallTreeNode(new Frame({...Frame.Root}), null),
    depth: -1,
    start: 0,
    end: 0,
    children: [],
  };

  formatter: (value: number) => string;
  timelineFormatter: (value: number) => string;

  static Empty(): Flamegraph {
    return new Flamegraph(Profile.Empty, 0, {
      inverted: false,
      sort: 'call order',
    });
  }

  static Example(): Flamegraph {
    return new Flamegraph(SampledProfile.Example, 0, {
      inverted: false,
      sort: 'call order',
    });
  }

  static From(
    from: Flamegraph,
    {
      inverted = false,
      sort = 'call order',
    }: {
      inverted?: Flamegraph['inverted'];
      sort?: Flamegraph['sort'];
    }
  ): Flamegraph {
    return new Flamegraph(from.profile, from.profileIndex, {
      inverted,
      sort,
    });
  }

  constructor(
    profile: Profile,
    profileIndex: number,
    {
      inverted = false,
      sort = 'call order',
      configSpace,
      collapseSystemFrames = false,
    }: {
      collapseSystemFrames?: boolean;
      configSpace?: Rect;
      inverted?: boolean;
      sort?: 'left heavy' | 'alphabetical' | 'call order';
    } = {}
  ) {
    this.inverted = inverted;
    this.sort = sort;

    // @TODO check if we can get rid of this profile reference
    this.profile = profile;
    this.profileIndex = profileIndex;

    // If a custom config space is provided, use it and draw the chart in it
    switch (this.sort) {
      case 'left heavy': {
        this.frames = this.buildSortedChart(profile, leftHeavyTreeSort);
        break;
      }
      case 'alphabetical':
        if (this.profile.type === 'flamechart') {
          throw new TypeError('Flamechart does not support alphabetical sorting');
        }
        this.frames = this.buildSortedChart(profile, alphabeticTreeSort);
        break;
      case 'call order':
        if (this.profile.type === 'flamegraph') {
          throw new TypeError('Flamegraph does not support call order sorting');
        }
        this.frames = this.buildCallOrderChart(profile);
        break;
      default:
        throw new TypeError(`Unknown flamechart sort type: ${this.sort}`);
    }

    this.formatter = makeFormatter(profile.unit);
    this.timelineFormatter = makeTimelineFormatter(profile.unit);

    if (collapseSystemFrames) {
      this.collapseSystemFrames();
    }

    if (this.profile.duration > 0) {
      this.configSpace = new Rect(
        0,
        0,
        configSpace ? configSpace.width : this.profile.duration,
        this.depth
      );
    } else {
      // If the profile duration is 0, set the flamegraph duration
      // to 1 second so we can render a placeholder grid
      this.configSpace = new Rect(
        0,
        0,
        this.profile.unit === 'nanoseconds'
          ? 1e9
          : this.profile.unit === 'microseconds'
          ? 1e6
          : this.profile.unit === 'milliseconds'
          ? 1e3
          : 1,
        this.depth
      );
    }

    const weight = this.root.children.reduce(
      (acc, frame) => acc + frame.node.totalWeight,
      0
    );

    this.root.node.totalWeight += weight;
    this.root.end = this.root.start + weight;
    this.root.frame.totalWeight += weight;
  }

  buildCallOrderChart(profile: Profile): FlamegraphFrame[] {
    const frames: FlamegraphFrame[] = [];
    const stack: FlamegraphFrame[] = [];
    let idx = 0;

    const openFrame = (node: CallTreeNode, value: number) => {
      const parent = lastOfArray(stack) ?? this.root;

      const frame: FlamegraphFrame = {
        key: idx,
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
      } else {
        this.root.children.push(frame);
      }

      stack.push(frame);
      idx++;
    };

    const closeFrame = (_: CallTreeNode, value: number) => {
      const stackTop = stack.pop();

      if (!stackTop) {
        // This is unreachable because the profile importing logic already checks this
        throw new Error('Unbalanced stack');
      }

      stackTop.end = value;
      stackTop.depth = stack.length;

      if (stackTop.end - stackTop.start === 0) {
        return;
      }

      frames.push(stackTop);
      this.depth = Math.max(stackTop.depth, this.depth);
    };

    profile.forEach(openFrame, closeFrame);
    return frames;
  }

  buildSortedChart(
    profile: Profile,
    sortFn: (tree: CallTreeNode) => void
  ): FlamegraphFrame[] {
    const frames: FlamegraphFrame[] = [];
    const stack: FlamegraphFrame[] = [];

    sortFn(profile.callTree);

    const virtualRoot: FlamegraphFrame = {
      key: -1,
      frame: CallTreeNode.Root.frame,
      node: CallTreeNode.Root,
      parent: null,
      children: [],
      depth: 0,
      start: 0,
      end: 0,
    };

    this.root = virtualRoot;
    let idx = 0;

    const openFrame = (node: CallTreeNode, value: number) => {
      const parent = lastOfArray(stack) ?? this.root;
      const frame: FlamegraphFrame = {
        key: idx,
        frame: node.frame,
        node,
        parent,
        children: [],
        depth: 0,
        start: value,
        end: value,
        profileIds: profile.callTreeNodeProfileIdMap.get(node),
      };

      if (parent) {
        parent.children.push(frame);
      } else {
        this.root.children.push(frame);
      }

      stack.push(frame);
      idx++;
    };

    const closeFrame = (_node: CallTreeNode, value: number) => {
      const stackTop = stack.pop();

      if (!stackTop) {
        throw new Error('Unbalanced stack');
      }

      stackTop.end = value;
      stackTop.depth = stack.length;

      // Dont draw 0 width frames
      if (stackTop.end - stackTop.start === 0) {
        return;
      }
      frames.push(stackTop);
      this.depth = Math.max(stackTop.depth, this.depth);
    };

    function visit(node: CallTreeNode, start: number) {
      if (!node.frame.isRoot) {
        openFrame(node, start);
      }

      let childTime = 0;

      node.children.forEach(child => {
        visit(child, start + childTime);
        childTime += child.totalWeight;
      });

      if (!node.frame.isRoot) {
        closeFrame(node, start + node.totalWeight);
      }
    }
    visit(profile.callTree, 0);
    return frames;
  }

  findAllMatchingFramesBy(
    query: string,
    fields: (keyof FlamegraphFrame['frame'])[]
  ): FlamegraphFrame[] {
    const matches: FlamegraphFrame[] = [];
    if (!fields.length) {
      throw new Error('No fields provided');
    }

    if (fields.length === 1) {
      for (let i = 0; i < this.frames.length; i++) {
        if (this.frames[i].frame[fields[0]] === query) {
          matches.push(this.frames[i]);
        }
      }
      return matches;
    }

    for (let i = 0; i < this.frames.length; i++) {
      for (let j = fields.length; j--; ) {
        if (this.frames[i].frame[fields[j]] === query) {
          matches.push(this.frames[i]);
        }
      }
    }

    return matches;
  }

  findAllMatchingFrames(frameName?: string, framePackage?: string): FlamegraphFrame[] {
    const matches: FlamegraphFrame[] = [];

    for (let i = 0; i < this.frames.length; i++) {
      if (
        this.frames[i].frame.name === frameName &&
        // the framePackage can match either the package or the module
        // this is an artifact of how we previously used image
        (this.frames[i].frame.package === framePackage ||
          this.frames[i].frame.module === framePackage)
      ) {
        matches.push(this.frames[i]);
      }
    }

    return matches;
  }

  collapseSystemFrames() {
    const {root, frames, depth} = buildCollapsedFlamegraph(collapse(this.root));
    this.root = root;
    this.depth = depth;
    this.frames = frames;
  }
}

const isSystemFrame = (frame: FlamegraphFrame) => !frame.node.frame.is_application;

function collapse(frame: FlamegraphFrame) {
  frame.children = frame.children.map(collapse);

  if (frame.frame.isRoot) {
    return frame;
  }

  const children = frame.children;

  if (children.length === 1) {
    const [child] = children;
    if (isSystemFrame(frame) && isSystemFrame(child)) {
      if (!child.collapsed) {
        child.collapsed = [];
      }
      child.collapsed.push(frame);
      child.parent = frame.parent;
      frame = child;
    }
  }

  return frame;
}

function buildCollapsedFlamegraph(root: FlamegraphFrame) {
  const frames: FlamegraphFrame[] = [];
  const stack = [root];
  let maxDepth = 0;
  while (stack.length) {
    const node = stack.pop();
    if (!node) {
      break;
    }
    maxDepth = Math.max(maxDepth, node.depth);

    if (!node.frame.isRoot) {
      frames.push(node);
    }

    for (const child of node.children) {
      child.depth = node.frame.isRoot ? 0 : node.depth + 1;

      stack.push(child);
    }
  }

  return {
    frames,
    root,
    depth: maxDepth,
  };
}
