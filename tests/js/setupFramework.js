/* global process */
import slugify from '@sindresorhus/slugify';
import puppeteer from 'puppeteer';

import React from 'react';
import {mount} from 'enzyme';
import App from 'app/views/app';
import OrganizationDetails from 'app/views/organizationDetails';
import OrganizationRoot from 'app/views/organizationRoot';

// import ReactDOM from 'react-dom';
// import sprite from 'svg-sprite-loader/runtime/sprite.build';
// import {toMatchImageSnapshot} from 'jest-image-snapshot';
// expect.extend({toMatchImageSnapshot});

process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error(reason);
});

MockApiClient.addMockResponse({
  url: '/organizations/',
  body: [TestStubs.Organization()],
});
MockApiClient.addMockResponse({
  url: '/organizations/org-slug/',
  body: TestStubs.Organization(),
});
MockApiClient.addMockResponse({
  url: '/internal/health/',
  body: {},
});
const client = puppeteer.launch();

expect.extend({
  async toSnapshot(received, argument) {
    // received = enzyme wrapper
    // ReactDOM.render(received, document.body);
    // console.log(sprite.stringify());
    const cloned = document.documentElement.cloneNode(true);
    // console.log('cloned', cloned);
    const body = cloned.getElementsByTagName('body').item(0);
    body.innerHTML = received.html();
    await client
      .then(async browser => {
        const page = await browser.newPage();
        page.setViewport({width: 1200, height: 600, deviceScaleFactor: 4});
        await page.setContent(cloned.outerHTML);
        const fs = require('fs');
        const css = fs
          .readFileSync('./static/dist/sentry.css', 'utf8')
          .replace(/[\r\n]+/g, '');
        page.addStyleTag({
          content: css,
        });
        console.log(this);
        await page.screenshot({
          path: `./.artifacts/jest/${slugify(this.currentTestName)}.png`,
          fullPage: true,
        });
        // expect(image).toMatchImageSnapshot();
        page.close();
      })
      .catch(err => {
        console.error(err);
      });
    // console.log(cloned.outerHTML);
    return {
      message: () => 'expected to save snapshot',
      pass: true,
    };
  },
  async toSnapshotWithShell(received, argument) {
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization()],
    });
    MockApiClient.addMockResponse({
      url: '/broadcasts/',
      body: [TestStubs.Organization()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: TestStubs.Organization(),
    });
    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {},
    });
    let wrapper = mount(
      <App>
        <OrganizationDetails params={{orgId: 'org-slug'}}>
          <OrganizationRoot params={{orgId: 'org-slug'}}>{received}</OrganizationRoot>
        </OrganizationDetails>, TestStubs.routerContext()
        {received}
      </App>,
      TestStubs.routerContext()
    );
    return this.toSnapshot(wrapper, argument);
  },
});
