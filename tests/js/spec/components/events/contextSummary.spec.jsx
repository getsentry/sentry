import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ContextSummary from 'app/components/events/contextSummary/contextSummary';
import {FILTER_MASK} from 'app/constants';
import ContextSummaryUser from 'app/components/events/contextSummary/contextSummaryUser';
import ContextSummaryGPU from 'app/components/events/contextSummary/contextSummaryGPU';
import ContextSummaryOS from 'app/components/events/contextSummary/contextSummaryOS';

const CONTEXT_USER = {
  email: 'mail@example.org',
  id: '1',
};

const CONTEXT_DEVICE = {
  arch: 'x86',
  family: 'iOS',
  model: 'iPhone10,5',
  type: 'device',
};

const CONTEXT_OS = {
  kernel_version: '17.5.0',
  version: '10.13.4',
  type: 'os',
  build: '17E199',
  name: 'Mac OS X',
};

const CONTEXT_OS_SERVER = {
  kernel_version: '4.3.0',
  version: '4.3.0',
  type: 'os',
  build: '123123123',
  name: 'Linux',
};

const CONTEXT_RUNTIME = {
  version: '1.7.13',
  type: 'runtime',
  name: 'Electron',
};

const CONTEXT_BROWSER = {
  version: '65.0.3325',
  name: 'Chrome',
};

describe('ContextSummary', function() {
  describe('render()', function() {
    it('renders nothing without contexts', () => {
      const event = {
        id: '',
        contexts: {},
      };

      const wrapper = mountWithTheme(<ContextSummary event={event} />);
      expect(wrapper).toSnapshot();
    });

    it('renders nothing with a single user context', () => {
      const event = {
        id: '',
        user: CONTEXT_USER,
        contexts: {},
      };

      const wrapper = mountWithTheme(<ContextSummary event={event} />);
      expect(wrapper).toSnapshot();
    });

    it('should bail out with empty contexts', () => {
      const event = {
        id: '',
        user: CONTEXT_USER,
        contexts: {
          device: {},
          os: {},
        },
      };

      const wrapper = mountWithTheme(<ContextSummary event={event} />);
      expect(wrapper).toSnapshot();
    });

    it('renders at least three contexts', () => {
      const event = {
        id: '',
        user: CONTEXT_USER,
        contexts: {
          device: CONTEXT_DEVICE,
        },
      };

      const wrapper = mountWithTheme(<ContextSummary event={event} />);
      expect(wrapper).toSnapshot();
    });

    it('renders up to four contexts', () => {
      const event = {
        id: '',
        user: CONTEXT_USER,
        contexts: {
          os: CONTEXT_OS,
          browser: CONTEXT_BROWSER,
          runtime: CONTEXT_RUNTIME,
          device: CONTEXT_DEVICE, // must be omitted
        },
      };

      const wrapper = mountWithTheme(<ContextSummary event={event} />);
      expect(wrapper).toSnapshot();
    });

    it('should prefer client_os over os', () => {
      const event = {
        id: '',
        user: CONTEXT_USER,
        contexts: {
          client_os: CONTEXT_OS,
          os: CONTEXT_OS_SERVER,
          browser: CONTEXT_BROWSER,
          runtime: CONTEXT_RUNTIME,
        },
      };

      const wrapper = mountWithTheme(<ContextSummary event={event} />);
      expect(wrapper).toSnapshot();
    });

    it('renders client_os too', () => {
      const event = {
        id: '',
        user: CONTEXT_USER,
        contexts: {
          client_os: CONTEXT_OS,
          browser: CONTEXT_BROWSER,
          runtime: CONTEXT_RUNTIME,
        },
      };

      const wrapper = mountWithTheme(<ContextSummary event={event} />);
      expect(wrapper).toSnapshot();
    });

    it('should skip non-default named contexts', () => {
      const event = {
        id: '',
        user: CONTEXT_USER,
        contexts: {
          os: CONTEXT_OS,
          chrome: CONTEXT_BROWSER, // non-standard context
          runtime: CONTEXT_RUNTIME,
          device: CONTEXT_DEVICE,
        },
      };

      const wrapper = mountWithTheme(<ContextSummary event={event} />);
      expect(wrapper).toSnapshot();
    });

    it('should skip a missing user context', () => {
      const event = {
        id: '',
        contexts: {
          os: CONTEXT_OS,
          chrome: CONTEXT_BROWSER, // non-standard context
          runtime: CONTEXT_RUNTIME,
          device: CONTEXT_DEVICE,
        },
      };

      const wrapper = mountWithTheme(<ContextSummary event={event} />);
      expect(wrapper).toSnapshot();
    });
  });
});

describe('OsSummary', function() {
  describe('render()', function() {
    it('renders the version string', () => {
      const os = {
        kernel_version: '17.5.0',
        version: '10.13.4',
        type: 'os',
        build: '17E199',
        name: 'Mac OS X',
      };

      const wrapper = mountWithTheme(<ContextSummaryOS data={os} />);
      expect(wrapper).toSnapshot();
    });

    it('renders the kernel version when no version', () => {
      const os = {
        kernel_version: '17.5.0',
        type: 'os',
        build: '17E199',
        name: 'Mac OS X',
      };

      const wrapper = mountWithTheme(<ContextSummaryOS data={os} />);
      expect(wrapper).toSnapshot();
    });

    it('renders unknown when no version', () => {
      const os = {
        type: 'os',
        build: '17E199',
        name: 'Mac OS X',
      };

      const wrapper = mountWithTheme(<ContextSummaryOS data={os} />);
      expect(wrapper).toSnapshot();
    });
  });
});

describe('GpuSummary', function() {
  describe('render()', function() {
    it('renders name and vendor', () => {
      const gpu = {
        name: 'Mali-T880',
        vendor_name: 'ARM',
        version: 'OpenGL ES 3.2 v1.r22p0-01rel0.f294e54ceb2cb2d81039204fa4b0402e',
      };

      const wrapper = mountWithTheme(<ContextSummaryGPU data={gpu} />);
      expect(wrapper).toSnapshot();
    });

    it('renders unknown when no vendor', () => {
      const gpu = {
        type: 'gpu',
        name: 'Apple A8 GPU',
      };

      const wrapper = mountWithTheme(<ContextSummaryGPU data={gpu} />);
      expect(wrapper).toSnapshot();
    });
  });
});

describe('UserSummary', function() {
  describe('render', function() {
    it('prefers email, then IP, then id, then username for title', function() {
      const user1 = {
        email: 'maisey@dogsrule.com',
        ip_address: '12.31.20.12',
        id: '26',
        username: 'maiseythedog',
        name: 'Maisey Dog',
        data: {siblings: ['Charlie Dog'], dreamsOf: 'squirrels'},
      };

      const wrapper1 = mountWithTheme(<ContextSummaryUser data={user1} />);
      expect(
        wrapper1
          .find('[data-test-id="user-title"]')
          .render()
          .text()
      ).toEqual(user1.email);

      const user2 = {
        ip_address: '12.31.20.12',
        id: '26',
        username: 'maiseythedog',
        name: 'Maisey Dog',
        data: {siblings: ['Charlie Dog'], dreamsOf: 'squirrels'},
      };

      const wrapper2 = mountWithTheme(<ContextSummaryUser data={user2} />);
      expect(
        wrapper2
          .find('[data-test-id="user-title"]')
          .render()
          .text()
      ).toEqual(user2.ip_address);

      const user3 = {
        id: '26',
        username: 'maiseythedog',
        name: 'Maisey Dog',
        data: {siblings: ['Charlie Dog'], dreamsOf: 'squirrels'},
      };

      const wrapper3 = mountWithTheme(<ContextSummaryUser data={user3} />);
      expect(
        wrapper3
          .find('[data-test-id="user-title"]')
          .render()
          .text()
      ).toEqual(user3.id);

      const user4 = {
        username: 'maiseythedog',
        name: 'Maisey Dog',
        data: {siblings: ['Charlie Dog'], dreamsOf: 'squirrels'},
      };

      const wrapper4 = mountWithTheme(<ContextSummaryUser data={user4} />);
      expect(
        wrapper4
          .find('[data-test-id="user-title"]')
          .render()
          .text()
      ).toEqual(user4.username);
    });

    it('renders NoSummary if no email, IP, id, or username', function() {
      const user = {
        name: 'Maisey Dog',
        data: {siblings: ['Charlie Dog'], dreamsOf: 'squirrels'},
      };

      const wrapper = mountWithTheme(<ContextSummaryUser data={user} />);
      expect(wrapper.find('[data-test-id="user-title"]')).toHaveLength(0);
      expect(wrapper.find('[data-test-id="no-summary-title"]').text()).toEqual(
        'Unknown User'
      );
    });

    it('does not use filtered values for title', function() {
      const user1 = {
        email: FILTER_MASK,
      };

      const wrapper1 = mountWithTheme(<ContextSummaryUser data={user1} />);
      expect(wrapper1.find('[data-test-id="user-title"]')).toHaveLength(0);
      expect(wrapper1.find('[data-test-id="no-summary-title"]').text()).toEqual(
        'Unknown User'
      );

      // TODO: currently, the IP filter just eliminates IP addresses rather than
      // filtering them like other user data, so here, where you'd expect a filtered
      // IP address, there isn't one. Add a similar entry to the above and below
      // if/when that changes.

      const user2 = {
        id: FILTER_MASK,
      };

      const wrapper2 = mountWithTheme(<ContextSummaryUser data={user2} />);
      expect(wrapper2.find('[data-test-id="user-title"]')).toHaveLength(0);
      expect(wrapper2.find('[data-test-id="no-summary-title"]').text()).toEqual(
        'Unknown User'
      );

      const user3 = {
        username: FILTER_MASK,
      };

      const wrapper3 = mountWithTheme(<ContextSummaryUser data={user3} />);
      expect(wrapper3.find('[data-test-id="user-title"]')).toHaveLength(0);
      expect(wrapper3.find('[data-test-id="no-summary-title"]').text()).toEqual(
        'Unknown User'
      );
    });

    it('does not use filtered values for avatar', function() {
      // id is never used for avatar purposes, but is enough to keep us from
      // ending up with a NoSummary component where the UserSummary component
      // should be
      const user1 = {
        id: '26',
        name: FILTER_MASK,
      };

      const wrapper1 = mountWithTheme(<ContextSummaryUser data={user1} />);
      expect(wrapper1.find('LetterAvatar').text()).toEqual('?');

      const user2 = {
        id: '26',
        email: FILTER_MASK,
      };

      const wrapper2 = mountWithTheme(<ContextSummaryUser data={user2} />);
      expect(wrapper2.find('LetterAvatar').text()).toEqual('?');

      const user3 = {
        id: '26',
        username: FILTER_MASK,
      };

      const wrapper3 = mountWithTheme(<ContextSummaryUser data={user3} />);
      expect(wrapper3.find('LetterAvatar').text()).toEqual('?');
    });
  });
});
