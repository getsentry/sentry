// Benchmarks allow us to make changes and evaluate performance before the code gets shipped to production.
// They can be used to make performance improvements or to test impact of newly added functionality.
// Run with: yarn run ts-node --project ./config/tsconfig.benchmark.json -r tsconfig-paths/register static/app/utils/profiling/renderers/textRenderer.benchmark.ts
import benchmarkjs from 'benchmark';
import maxBy from 'lodash/maxBy';

import {initializeLocale} from 'sentry/bootstrap/initializeLocale';
import {FlamegraphSearch} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphSearch';
import {TextRenderer} from 'sentry/utils/profiling/renderers/textRenderer';

import {Flamegraph} from '../flamegraph';
import {LightFlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {Rect, Transform} from '../gl/utils';
import typescriptTrace from '../profile/formats/typescript/trace.json';
import {importProfile} from '../profile/importProfile';

import {FlamegraphFrame, getFlamegraphFrameSearchId} from './../flamegraphFrame';

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

const makeDrawFullScreen = (renderer: TextRenderer, flamegraph: Flamegraph) => {
  const transform = Transform.transformMatrixBetweenRect(
    flamegraph.configSpace,
    new Rect(0, 0, 1000, 1000)
  );
  return (searchResults?: FlamegraphSearch) => {
    renderer.draw(flamegraph.configSpace, transform, searchResults);
  };
};

const makeDrawCenterScreen = (renderer: TextRenderer, flamegraph: Flamegraph) => {
  const configView = new Rect(
    flamegraph.configSpace.width * 0.25, // 25% to left
    0,
    flamegraph.configSpace.width * 0.5, // 50% width
    1000
  );
  const transform = Transform.transformMatrixBetweenRect(
    configView,
    new Rect(0, 0, 1000, 1000)
  );

  return (searchResults?: FlamegraphSearch) => {
    renderer.draw(configView, transform, searchResults);
  };
};

const makeDrawRightSideOfScreen = (renderer: TextRenderer, flamegraph: Flamegraph) => {
  const configView = new Rect(
    flamegraph.configSpace.width * 0.75, // 75% to left
    0,
    flamegraph.configSpace.width * 0.25, // 25% width
    1000
  );
  const transform = Transform.transformMatrixBetweenRect(
    configView,
    new Rect(0, 0, 1000, 1000)
  );

  return (searchResults?: FlamegraphSearch) => {
    renderer.draw(configView, transform, searchResults);
  };
};

const tsProfile = importProfile(typescriptTrace as any, '');
const tsFlamegraph = new Flamegraph(tsProfile.profiles[0], 0, {
  inverted: false,
  leftHeavy: false,
});

const typescriptRenderer = new TextRenderer(
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
  tsFlamegraph,
  LightFlamegraphTheme
);

interface FramePartitionData {
  count: number;
  frames: Set<FlamegraphFrame>;
}

const framesPartitionedByWords = tsFlamegraph.frames.reduce((acc, frame) => {
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
}, {} as Record<string, FramePartitionData>);

const [word, data] = maxBy(
  Object.entries(framesPartitionedByWords),
  ([_, partitionData]) => {
    return partitionData.frames.size;
  }
)!;

const searchResults: FlamegraphSearch = {
  results: Array.from(data.frames.values()).reduce((acc, frame) => {
    acc[getFlamegraphFrameSearchId(frame)] = frame;
    return acc;
  }, {}),
  query: word,
};

benchmark('typescript (full profile)', () =>
  makeDrawFullScreen(typescriptRenderer, tsFlamegraph)()
);
benchmark('typescript (center half)', () =>
  makeDrawCenterScreen(typescriptRenderer, tsFlamegraph)()
);
benchmark('typescript (right quarter)', () =>
  makeDrawRightSideOfScreen(typescriptRenderer, tsFlamegraph)()
);

benchmark(
  `typescript (full profile, w/ search matching ${data.frames.size} of ${tsFlamegraph.frames.length})`,
  () => makeDrawFullScreen(typescriptRenderer, tsFlamegraph)(searchResults)
);

benchmark('typescript (center half, w/ search)', () =>
  makeDrawCenterScreen(typescriptRenderer, tsFlamegraph)(searchResults)
);
benchmark('typescript (right quarter, w/ search)', () =>
  makeDrawRightSideOfScreen(typescriptRenderer, tsFlamegraph)(searchResults)
);
