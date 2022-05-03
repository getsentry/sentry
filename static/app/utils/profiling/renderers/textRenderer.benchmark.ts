// Benchmarks allow us to make changes and evaluate performance before the code gets shipped to production.
// They can be used to make performance improvements or to test impact of newly added functionality.

// Run with: yarn run ts-node --project ./config/tsconfig.benchmark.json -r tsconfig-paths/register static/app/utils/profiling/renderers/textRenderer.benchmark.ts

import benchmarkjs from 'benchmark';

import {initializeLocale} from 'sentry/bootstrap/initializeLocale';
import {TextRenderer} from 'sentry/utils/profiling/renderers/textRenderer';

import {Flamegraph} from '../flamegraph';
import {LightFlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {Rect, Transform} from '../gl/utils';
import typescriptTrace from '../profile/formats/typescript/trace.json';
import {importProfile} from '../profile/importProfile';

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

  suite.run({async: true});
}

global.window = {devicePixelRatio: 1};

const makeDrawFullScreen = (renderer: TextRenderer, flamegraph: Flamegraph) => {
  const transform = Transform.transformMatrixBetweenRect(
    flamegraph.configSpace,
    new Rect(0, 0, 1000, 1000)
  );
  return () => {
    renderer.draw(flamegraph.configSpace, transform);
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

  return () => {
    renderer.draw(configView, transform);
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

  return () => {
    renderer.draw(configView, transform);
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

benchmark('typescript (full profile)', () =>
  makeDrawFullScreen(typescriptRenderer, tsFlamegraph)()
);
benchmark('typescript (center half)', () =>
  makeDrawCenterScreen(typescriptRenderer, tsFlamegraph)()
);
benchmark('typescript (right quarter)', () =>
  makeDrawRightSideOfScreen(typescriptRenderer, tsFlamegraph)()
);
