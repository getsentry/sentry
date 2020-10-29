import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ExceptionMechanism from 'app/components/events/interfaces/exceptionMechanism';

describe('ExceptionMechanism', () => {
  describe('basic attributes', () => {
    it('should render the exception mechanism', () => {
      const mechanism = {type: 'generic'};
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });

    it('should render a help_link icon', () => {
      const mechanism = {type: 'generic', help_link: 'https://example.org/help'};
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });

    it('should render a description hovercard', () => {
      const mechanism = {type: 'generic', description: 'Nothing to see here.'};
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });

    it('should add the help_link to the description hovercard', () => {
      const mechanism = {
        type: 'generic',
        description: 'Nothing to see here.',
        help_link: 'https://example.org/help',
      };
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });

    it('should not add the help_link if not starts with http(s)', () => {
      const mechanism = {
        type: 'generic',
        description: 'Nothing to see here.',
        help_link: 'example.org/help',
      };
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });

    it('should render the handled pill', () => {
      const mechanism = {type: 'generic', handled: false};
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });
  });

  describe('errno meta', () => {
    it('should render the errno number', () => {
      const mechanism = {type: 'generic', meta: {errno: {number: 7}}};
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });

    it('should prefer the errno name if present', () => {
      const mechanism = {type: 'generic', meta: {errno: {number: 7, name: 'E2BIG'}}};
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });
  });

  describe('mach_exception meta', () => {
    it('should render the mach exception number', () => {
      const mechanism = {
        type: 'generic',
        meta: {mach_exception: {exception: 1, subcode: 8, code: 1}},
      };
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });

    it('should prefer the exception name if present', () => {
      const mechanism = {
        type: 'generic',
        meta: {
          mach_exception: {exception: 1, subcode: 8, code: 1, name: 'EXC_BAD_ACCESS'},
        },
      };
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });
  });

  describe('signal meta', () => {
    it('should render the signal number', () => {
      const mechanism = {type: 'generic', meta: {signal: {number: 11}}};
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });

    it('should add the signal code if present', () => {
      const mechanism = {type: 'generic', meta: {signal: {number: 11, code: 0}}};
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });

    it('should prefer signal and code names if present', () => {
      const mechanism = {
        type: 'generic',
        meta: {signal: {number: 11, code: 0, name: 'SIGSEGV', code_name: 'SEGV_NOOP'}},
      };
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });
  });

  describe('additional data', () => {
    it('should render all fields in the data object', () => {
      const mechanism = {type: 'generic', data: {relevant_address: '0x1'}};
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });

    it('should skip object-like values', () => {
      const mechanism = {
        type: 'generic',
        data: {
          a: {x: 11},
          b: [4, 2],
          c: new Date(),
        },
      };
      const wrapper = mountWithTheme(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toSnapshot();
    });
  });
});
