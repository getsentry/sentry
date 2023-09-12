import {render} from 'sentry-test/reactTestingLibrary';

import {Mechanism} from 'sentry/components/events/interfaces/crashContent/exception/mechanism';
import {StackTraceMechanism} from 'sentry/types/stacktrace';

describe('ExceptionMechanism', function () {
  describe('basic attributes', function () {
    it('should render the exception mechanism', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: true,
      };
      render(<Mechanism data={mechanism} />);
    });

    it('should render a help_link icon', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: true,
        help_link: 'https://example.org/help',
      };

      render(<Mechanism data={mechanism} />);
    });

    it('should render a description hovercard', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: true,
        description: 'Nothing to see here.',
      };

      render(<Mechanism data={mechanism} />);
    });

    it('should add the help_link to the description hovercard', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: true,
        description: 'Nothing to see here.',
        help_link: 'https://example.org/help',
      };

      render(<Mechanism data={mechanism} />);
    });

    it('should not add the help_link if not starts with http(s)', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: true,
        description: 'Nothing to see here.',
        help_link: 'example.org/help',
      };
      render(<Mechanism data={mechanism} />);
    });

    it('should render the handled pill', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
      };
      render(<Mechanism data={mechanism} />);
    });
  });

  describe('errno meta', function () {
    it('should render the errno number', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        meta: {errno: {number: 7}},
      };

      render(<Mechanism data={mechanism} />);
    });

    it('should prefer the errno name if present', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        meta: {errno: {number: 7, name: 'E2BIG'}},
      };

      render(<Mechanism data={mechanism} />);
    });
  });

  describe('mach_exception meta', function () {
    it('should render the mach exception number', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        meta: {mach_exception: {exception: 1, subcode: 8, code: 1}},
      };

      render(<Mechanism data={mechanism} />);
    });

    it('should prefer the exception name if present', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        meta: {
          mach_exception: {exception: 1, subcode: 8, code: 1, name: 'EXC_BAD_ACCESS'},
        },
      };

      render(<Mechanism data={mechanism} />);
    });
  });

  describe('signal meta', function () {
    it('should render the signal number', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        meta: {signal: {number: 11}},
      };

      render(<Mechanism data={mechanism} />);
    });

    it('should add the signal code if present', function () {
      const mechanism = {
        type: 'generic',
        handled: false,
        meta: {signal: {number: 11, code: 0}},
      };

      render(<Mechanism data={mechanism} />);
    });

    it('should prefer signal and code names if present', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        meta: {signal: {number: 11, code: 0, name: 'SIGSEGV', code_name: 'SEGV_NOOP'}},
      };

      render(<Mechanism data={mechanism} />);
    });
  });

  describe('additional data', function () {
    it('should render all fields in the data object', function () {
      const mechanism = {
        type: 'generic',
        handled: false,
        data: {relevant_address: '0x1'},
      };

      render(<Mechanism data={mechanism} />);
    });

    it('should skip object-like values', function () {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        data: {
          a: {x: 11},
          b: [4, 2],
          c: new Date(),
        },
      };
      render(<Mechanism data={mechanism} />);
    });
  });
});
