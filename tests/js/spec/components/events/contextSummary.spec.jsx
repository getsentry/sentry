import React from 'react';
import {shallow} from 'enzyme';

import ContextSummary, {OsSummary} from 'app/components/events/contextSummary';

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
    it('should render nothing without contexts', () => {
      const event = {
        id: '',
        contexts: {},
      };

      const wrapper = shallow(<ContextSummary event={event} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should render nothing with a single user context', () => {
      const event = {
        id: '',
        user: CONTEXT_USER,
        contexts: {},
      };

      const wrapper = shallow(<ContextSummary event={event} />);
      expect(wrapper).toMatchSnapshot();
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

      const wrapper = shallow(<ContextSummary event={event} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should render at least three contexts', () => {
      const event = {
        id: '',
        user: CONTEXT_USER,
        contexts: {
          device: CONTEXT_DEVICE,
        },
      };

      const wrapper = shallow(<ContextSummary event={event} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should render up to four contexts', () => {
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

      const wrapper = shallow(<ContextSummary event={event} />);
      expect(wrapper).toMatchSnapshot();
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

      const wrapper = shallow(<ContextSummary event={event} />);
      expect(wrapper).toMatchSnapshot();
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

      const wrapper = shallow(<ContextSummary event={event} />);
      expect(wrapper).toMatchSnapshot();
    });
  });
});

describe('OsSummary', function() {
  describe('render()', function() {
    it('should render the version string', () => {
      const os = {
        kernel_version: '17.5.0',
        version: '10.13.4',
        type: 'os',
        build: '17E199',
        name: 'Mac OS X',
      };

      const wrapper = shallow(<OsSummary data={os} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should render the kernel version when no version', () => {
      const os = {
        kernel_version: '17.5.0',
        type: 'os',
        build: '17E199',
        name: 'Mac OS X',
      };

      const wrapper = shallow(<OsSummary data={os} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should render unknown when no version', () => {
      const os = {
        type: 'os',
        build: '17E199',
        name: 'Mac OS X',
      };

      const wrapper = shallow(<OsSummary data={os} />);
      expect(wrapper).toMatchSnapshot();
    });
  });
});
