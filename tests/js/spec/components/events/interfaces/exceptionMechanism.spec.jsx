import React from 'react';
import {shallow} from 'enzyme';

import ExceptionMechanism from 'app/components/events/interfaces/exceptionMechanism';

describe('ExceptionMechanism', () => {
  describe('basic attributes', () => {
    it('should render the exception mechanism', () => {
      let mechanism = {type: 'generic'};
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should render a help_link icon', () => {
      let mechanism = {type: 'generic', help_link: 'https://example.org/help'};
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should render a description hovercard', () => {
      let mechanism = {type: 'generic', description: 'Nothing to see here.'};
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should add the help_link to the description hovercard', () => {
      let mechanism = {
        type: 'generic',
        description: 'Nothing to see here.',
        help_link: 'https://example.org/help',
      };
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should render the handled pill', () => {
      let mechanism = {type: 'generic', handled: false};
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('errno meta', () => {
    it('should render the errno number', () => {
      let mechanism = {type: 'generic', meta: {errno: {number: 7}}};
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should prefer the errno name if present', () => {
      let mechanism = {type: 'generic', meta: {errno: {number: 7, name: 'E2BIG'}}};
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('mach_exception meta', () => {
    it('should render the mach exception number', () => {
      let mechanism = {
        type: 'generic',
        meta: {mach_exception: {exception: 1, subcode: 8, code: 1}},
      };
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should prefer the exception name if present', () => {
      let mechanism = {
        type: 'generic',
        meta: {
          mach_exception: {exception: 1, subcode: 8, code: 1, name: 'EXC_BAD_ACCESS'},
        },
      };
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('signal meta', () => {
    it('should render the signal number', () => {
      let mechanism = {type: 'generic', meta: {signal: {number: 11}}};
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should add the signal code if present', () => {
      let mechanism = {type: 'generic', meta: {signal: {number: 11, code: 0}}};
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should prefer signal and code names if present', () => {
      let mechanism = {
        type: 'generic',
        meta: {signal: {number: 11, code: 0, name: 'SIGSEGV', code_name: 'SEGV_NOOP'}},
      };
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('additional data', () => {
    it('should render all fields in the data object', () => {
      let mechanism = {type: 'generic', data: {relevant_address: '0x1'}};
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('should skip object-like values', () => {
      let mechanism = {
        type: 'generic',
        data: {
          a: {x: 11},
          b: [4, 2],
          c: new Date(),
        },
      };
      let wrapper = shallow(<ExceptionMechanism data={mechanism} />);
      expect(wrapper).toMatchSnapshot();
    });
  });
});
