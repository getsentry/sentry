// Benchmarks allow us to make changes and evaluate performance before the code gets shipped to production.
// They can be used to make performance improvements or to test impact of newly added functionality.
// Run with: yarn run ts-node --project ./config/tsconfig.benchmark.json -r tsconfig-paths/register static/app/utils/profiling/renderers/textRenderer.benchmark.ts
import benchmarkjs from 'benchmark';
import maxBy from 'lodash/maxBy';

import {initializeLocale} from '../../../bootstrap/initializeLocale';
import {Flamegraph} from '../flamegraph';
import {FlamegraphSearch} from '../flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import {LightFlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {FlamegraphFrame, getFlamegraphFrameSearchId} from '../flamegraphFrame';
import {transformMatrixBetweenRect} from '../gl/utils';
import androidTrace from '../profile/formats/android/trace.json';
import ios from '../profile/formats/ios/trace.json';
import {importProfile} from '../profile/importProfile';
import {Rect} from '../speedscope';

import {FlamegraphTextRenderer} from './flamegraphTextRenderer';

// This logs an error which is annoying to see in the outputs
initializeLocale({} as any);

// We dont compare benchmark results, as we are testing a single version of the code, so we run this as a baseline,
// store the results somewhere locally and then compare the results with the new version of our code.
function benchmark(name: string, callback: () => void) {
  const suite = new benchmarkjs.Suite();

  suite
    .add(name, callback)
    .on('cycle', event => {
      // well, we need to see the results somewhere
      // eslint-disable-next-line
      console.log(event.target.toString());
    })
    .on('error', event => {
      // If something goes wrong, fail early
      throw event;
    });

  suite.run({async: false});
}

global.window = {devicePixelRatio: 1};

const makeDrawFullScreen = (renderer: FlamegraphTextRenderer, flamegraph: Flamegraph) => {
  const configView = new Rect(
    0,
    0,
    flamegraph.configSpace.width, // 50% width
    1000
  ).withY(0);

  const transform = transformMatrixBetweenRect(configView, new Rect(0, 0, 1000, 1000));
  return (searchResults?: FlamegraphSearch) => {
    renderer.draw(flamegraph.configSpace, transform, searchResults);
  };
};

const makeDrawCenterScreen = (
  renderer: FlamegraphTextRenderer,
  flamegraph: Flamegraph
) => {
  const configView = new Rect(
    flamegraph.configSpace.width * 0.25, // 25% to left
    0,
    flamegraph.configSpace.width * 0.5, // 50% width
    1000
  ).withY(0);
  const transform = transformMatrixBetweenRect(configView, new Rect(0, 0, 1000, 1000));

  return (searchResults?: FlamegraphSearch) => {
    renderer.draw(configView, transform, searchResults);
  };
};

const makeDrawRightSideOfScreen = (
  renderer: FlamegraphTextRenderer,
  flamegraph: Flamegraph
) => {
  const configView = new Rect(
    flamegraph.configSpace.width * 0.75, // 75% to left
    0,
    flamegraph.configSpace.width * 0.25, // 25% width
    1000
  ).withY(0);
  const transform = transformMatrixBetweenRect(configView, new Rect(0, 0, 1000, 1000));

  return (searchResults?: FlamegraphSearch) => {
    renderer.draw(configView, transform, searchResults);
  };
};

const androidProfile = importProfile(androidTrace as any, '', 'flamechart');
const androidFlamegraph = new Flamegraph(
  androidProfile.profiles[androidProfile.activeProfileIndex] as any,
  0,
  {
    inverted: false,
    sort: 'call order',
  }
);

const iosProfile = importProfile(ios as any, '', 'flamechart');
const iosFlamegraph = new Flamegraph(
  iosProfile.profiles[iosProfile.activeProfileIndex] as any,
  0,
  {
    inverted: false,
    sort: 'call order',
  }
);

const makeTextRenderer = flamegraph =>
  new FlamegraphTextRenderer(
    {
      clientWidth: 1000,
      clientHeight: 1000,
      clientLeft: 0,
      clientTop: 0,
      getContext: () => {
        return {
          fillRect: () => {},
          fillText: () => {},
          measureText: (t: string) => {
            return {
              width: t.length,
            };
          },
        };
      },
    },
    LightFlamegraphTheme,
    flamegraph
  );

interface FramePartitionData {
  count: number;
  frames: Set<FlamegraphFrame>;
}

const makeSearchResults = (flamegraph: Flamegraph): FlamegraphSearch => {
  const framesPartitionedByWords = flamegraph.frames.reduce(
    (acc, frame) => {
      const words = frame.frame.name.split(' ');
      words.forEach(w => {
        if (!acc[w]) {
          acc[w] = {
            count: 0,
            frames: new Set(),
          };
        }
        const node = acc[w];
        node.count++;
        node.frames.add(frame);
      });
      return acc;
    },
    {} as Record<string, FramePartitionData>
  );

  const [word, data] = maxBy(
    Object.entries(framesPartitionedByWords),
    ([_, partitionData]) => {
      return partitionData.frames.size;
    }
  )!;

  return {
    results: Array.from(data.frames.values()).reduce((acc, frame) => {
      acc[getFlamegraphFrameSearchId(frame)] = frame;
      return acc;
    }, {}),
    query: word,
  };
};

const suite = (
  name: string,
  textRenderer: FlamegraphTextRenderer,
  flamegraph: Flamegraph
) => {
  const results = makeSearchResults(flamegraph);
  benchmark(`${name} (full profile)`, () =>
    makeDrawFullScreen(textRenderer, flamegraph)(new Map())
  );
  benchmark(`${name} (center half)`, () =>
    makeDrawCenterScreen(textRenderer, flamegraph)(new Map())
  );
  benchmark(`${name} (right quarter)`, () =>
    makeDrawRightSideOfScreen(textRenderer, flamegraph)(new Map())
  );

  benchmark(
    `${name} (full profile, w/ search matching ${flamegraph.frames.length} of ${flamegraph.frames.length})`,
    () => makeDrawFullScreen(textRenderer, flamegraph)(results)
  );

  benchmark(
    `${name} (center half, w/ search ${flamegraph.frames.length} of ${flamegraph.frames.length})`,
    () => makeDrawCenterScreen(textRenderer, flamegraph)(results)
  );
  benchmark(
    `${name} (right quarter, w/ search ${flamegraph.frames.length} of ${flamegraph.frames.length})`,
    () => makeDrawRightSideOfScreen(textRenderer, flamegraph)(results)
  );
};

suite('android', makeTextRenderer(androidFlamegraph), androidFlamegraph);
suite('ios', makeTextRenderer(iosFlamegraph), iosFlamegraph);
