/* global process */
// jest snapshot serializer for emotion
import PercyClient from 'percy-client';
import ReactDOM from 'react-dom';
import Environment from 'percy-client/dist/environment';
import slugify from 'slugify';
import sprite from 'svg-sprite-loader/runtime/sprite.build';
import puppeteer from 'puppeteer';
const {toMatchImageSnapshot} = require('jest-image-snapshot');

process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error(reason);
});

function createPercyClient() {
  const token = process.env.PERCY_TOKEN;
  const apiUrl = process.env.PERCY_API;
  const clientInfo = `percy-jest 0.1.0`;
  return new PercyClient({token, apiUrl, clientInfo});
}
function parseMissingResources(response) {
  return (
    (response.body.data &&
      response.body.data.relationships &&
      response.body.data.relationships['missing-resources'] &&
      response.body.data.relationships['missing-resources'].data) ||
    []
  );
}
function uploadMissingResources(percyClient, buildId, response, shaToResource) {
  const missingResources = parseMissingResources(response);
  console.log('missing resources', missingResources);
  const promises = [];
  if (missingResources.length > 0) {
    for (const missingResource of missingResources) {
      promises.push(
        percyClient
          .uploadResource(buildId, shaToResource[missingResource.id].content)
          .then(() => {})
          // eslint-disable-next-line no-console
          .catch(err => console.log('[percy jest] uploadMissingResources', err))
      );
    }
  }
  return Promise.all(promises);
}
const percy = createPercyClient();
const environment = new Environment(process.env);

async function testSnapshot({currentTestName, source}) {
  const build = await percy.createBuild(environment.repo, {resources: []});
  const buildId = build.body.data.id;
  // console.log(build);
  // console.log(percy);
  // console.log(this.currentTestName);
  try {
    const rootResource = percy.makeResource({
      resourceUrl: '/',
      content: source,
      isRoot: true,
      mimetype: 'text/html',
    });

    const snapshot = await percy.createSnapshot(buildId, [rootResource], {
      name: slugify(currentTestName),
      // content:
    });
    console.log(snapshot.body.data);
    const snapshotId = snapshot.body.data.id;
    const shaToResource = {};
    shaToResource[rootResource.sha] = rootResource;
    await uploadMissingResources(percy, buildId, snapshot, shaToResource);
    percy.finalizeSnapshot(snapshotId);
  } catch (err) {
    console.log(err.message);
  }
  let resp = await percy.finalizeBuild(buildId);
  console.log(resp.body);
  // console.log(received.getDOMNode()); console.log(document.documentElement.outerHTML);
}
expect.extend({
  toPercy: function(received, argument) {
    // ReactDOM.render(received, document.body);
    // console.log(sprite.stringify());
    const cloned = document.documentElement.cloneNode(true);
    const body = cloned.getElementsByTagName('body').item(0);
    body.innerHTML = received.html();
    puppeteer.launch().then(async browser => {
      const page = await browser.newPage();
      page.setViewport({width: 1200, height: 600, deviceScaleFactor: 4});
      await page.setContent(cloned.outerHTML);
      const image = await page.screenshot({
        path: `${this.currentTestName}.png`,
        fullPage: true,
      });
      expect(image).toMatchImageSnapshot();
      await browser.close();
    });
    console.log(cloned.outerHTML);
    // testSnapshot({
    //   currentTestName: this.currentTestName,
    //   source: cloned.outerHTML,
    // });
    // console.log(received.getDOMNode()); console.log(document.documentElement.outerHTML);
    return {
      message: () => 'expected to save to Percy',
      pass: true,
    };
  },
});

expect.extend({toMatchImageSnapshot});
