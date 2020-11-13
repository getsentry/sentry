import React from 'react';

import {mount} from 'sentry-test/enzyme';

import App from 'app/views/app';
import ConfigStore from 'app/stores/configStore';

jest.mock('jquery');

describe('App', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization({slug: 'billy-org', name: 'billy org'})],
    });

    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });

    MockApiClient.addMockResponse({
      url: '/assistant/?v2',
      body: [],
    });
  });

  it('renders newsletter consent with flag', async function () {
    const user = ConfigStore.get('user');
    user.flags.newsletter_consent_prompt = true;
    // XXX(dcramer): shouldnt need to re-set
    ConfigStore.set('user', user);

    const wrapper = mount(
      <App params={{orgId: 'org-slug'}}>{<div>placeholder content</div>}</App>
    );

    expect(wrapper.find('NewsletterConsent')).toHaveLength(1);
  });

  it('does not render newsletter consent without flag', async function () {
    const user = ConfigStore.get('user');
    user.flags.newsletter_consent_prompt = false;
    // XXX(dcramer): shouldnt need to re-set
    ConfigStore.set('user', user);

    const wrapper = mount(
      <App params={{orgId: 'org-slug'}}>{<div>placeholder content</div>}</App>
    );

    expect(wrapper.find('NewsletterConsent')).toHaveLength(0);
  });
});
