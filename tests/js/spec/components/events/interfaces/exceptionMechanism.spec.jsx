import React from 'react';
import {mount} from 'enzyme';

import ExceptionMechanism from 'app/components/events/interfaces/exceptionMechanism';

describe('ExceptionMechanism', function() {
  let sandbox;
  let mechanism;
  let platform;
  let elem;

  beforeEach(function() {
    platform = 'cocoa';

    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render', function() {
    it('should render no Pills on empty', function() {
      mechanism = {};
      elem = mount(<ExceptionMechanism data={mechanism} platform={platform} />);
      expect(elem.find('li')).toHaveLength(0);
    });

    it('should not render generic pills if description is missing', function() {
      mechanism = {
        type: 'promise',
      };
      elem = mount(<ExceptionMechanism data={mechanism} platform={platform} />);
      expect(elem.find('li')).toHaveLength(0);
    });

    it('should render one mach_exception', function() {
      mechanism = {
        mach_exception: {
          exception_name: 'EXC_!',
        },
      };
      elem = mount(<ExceptionMechanism data={mechanism} platform={platform} />);
      expect(elem.find('li')).toHaveLength(1);
      expect(
        elem
          .find('li')
          .find('span')
          .first()
          .text()
      ).toEqual('mach exception');
      expect(
        elem
          .find('li')
          .find('span')
          .last()
          .text()
      ).toEqual('EXC_!');
    });

    it('should render one posix_signal', function() {
      mechanism = {
        posix_signal: {
          name: 'SIG_',
          signal: '01',
        },
      };
      elem = mount(<ExceptionMechanism data={mechanism} platform={platform} />);
      expect(elem.find('li')).toHaveLength(1);
      expect(
        elem
          .find('li')
          .find('span')
          .first()
          .text()
      ).toEqual('signal');
      expect(
        elem
          .find('li')
          .find('span')
          .last()
          .text()
      ).toEqual('SIG_ (01)');
    });

    it('should render posix_signal and mach_exception', function() {
      mechanism = {
        posix_signal: {
          name: 'SIG_',
          signal: '01',
        },
        mach_exception: {
          exception_name: 'EXC_!',
        },
      };
      elem = mount(<ExceptionMechanism data={mechanism} platform={platform} />);
      expect(elem.find('li')).toHaveLength(2);
      expect(
        elem
          .find('li')
          .first()
          .find('span')
          .first()
          .text()
      ).toEqual('mach exception');
      expect(
        elem
          .find('li')
          .first()
          .find('span')
          .last()
          .text()
      ).toEqual('EXC_!');
      expect(
        elem
          .find('li')
          .last()
          .find('span')
          .first()
          .text()
      ).toEqual('signal');
      expect(
        elem
          .find('li')
          .last()
          .find('span')
          .last()
          .text()
      ).toEqual('SIG_ (01)');
    });

    it('should render generic mechanism', function() {
      mechanism = {
        type: 'promise',
        description: 'unhandledPromiseRejection',
      };
      elem = mount(<ExceptionMechanism data={mechanism} platform={platform} />);
      expect(elem.find('li')).toHaveLength(1);
      expect(
        elem
          .find('li')
          .find('span')
          .first()
          .text()
      ).toEqual('promise');
      expect(
        elem
          .find('li')
          .find('span')
          .last()
          .text()
      ).toEqual('unhandledPromiseRejection');
    });

    it('should render generic mechanism with extra', function() {
      mechanism = {
        type: 'promise',
        description: 'unhandledPromiseRejection',
        extra: {
          pid: 0,
          or: 'anything really',
        },
      };
      elem = mount(<ExceptionMechanism data={mechanism} platform={platform} />);
      expect(elem.find('li')).toHaveLength(3);
      expect(
        elem
          .find('li')
          .first()
          .find('span')
          .first()
          .text()
      ).toEqual('promise');
      expect(
        elem
          .find('li')
          .first()
          .find('span')
          .last()
          .text()
      ).toEqual('unhandledPromiseRejection');
      expect(
        elem
          .find('li')
          .last()
          .find('span')
          .first()
          .text()
      ).toEqual('or');
      expect(
        elem
          .find('li')
          .last()
          .find('span')
          .last()
          .text()
      ).toEqual('anything really');
    });

    it('should not render generic mechanism with extra containing object', function() {
      mechanism = {
        type: 'promise',
        description: 'unhandledPromiseRejection',
        extra: {
          pid: 0,
          or: 'anything really',
          ob: {iam: 'an object'},
        },
      };
      elem = mount(<ExceptionMechanism data={mechanism} platform={platform} />);
      expect(elem.find('li')).toHaveLength(3);
    });
  });
});
