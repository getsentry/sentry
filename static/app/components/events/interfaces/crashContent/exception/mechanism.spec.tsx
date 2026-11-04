import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Mechanism} from 'sentry/components/events/interfaces/crashContent/exception/mechanism';
import type {StackTraceMechanism} from 'sentry/types/stacktrace';

describe('ExceptionMechanism', () => {
  describe('basic attributes', () => {
    it('should render the exception mechanism', () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: true,
      };
      render(<Mechanism data={mechanism} />);

      expect(screen.getByText('mechanism')).toBeInTheDocument();
      expect(screen.getByText('generic')).toBeInTheDocument();
    });

    it('should render a help_link icon', () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: true,
        help_link: 'https://example.org/help',
      };

      render(<Mechanism data={mechanism} />);

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        'https://example.org/help'
      );
    });

    it('should render a description hovercard', async () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: true,
        description: 'Nothing to see here.',
      };

      render(<Mechanism data={mechanism} />);

      expect(screen.queryByText('Nothing to see here.')).not.toBeInTheDocument();
      await userEvent.hover(screen.getByText('generic'));
      expect(await screen.findByText('Nothing to see here.')).toBeInTheDocument();
    });

    it('should add the help_link to the description hovercard', async () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: true,
        description: 'Nothing to see here.',
        help_link: 'https://example.org/help',
      };

      render(<Mechanism data={mechanism} />);

      // The link lives in the hovercard header, not next to the mechanism name
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      await userEvent.hover(screen.getByText('generic'));
      expect(await screen.findByText('Nothing to see here.')).toBeInTheDocument();
      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        'https://example.org/help'
      );
    });

    it('should not add the help_link if not starts with http(s)', async () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: true,
        description: 'Nothing to see here.',
        help_link: 'example.org/help',
      };
      render(<Mechanism data={mechanism} />);

      await userEvent.hover(screen.getByText('generic'));
      expect(await screen.findByText('Nothing to see here.')).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('should render the handled pill', () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
      };
      render(<Mechanism data={mechanism} />);

      expect(screen.getByText('handled')).toBeInTheDocument();
      expect(screen.getByText('false')).toBeInTheDocument();
    });
  });

  describe('errno meta', () => {
    it('should render the errno number', () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        meta: {errno: {number: 7}},
      };

      render(<Mechanism data={mechanism} />);

      expect(screen.getByText('errno')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('should prefer the errno name if present', () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        meta: {errno: {number: 7, name: 'E2BIG'}},
      };

      render(<Mechanism data={mechanism} />);

      expect(screen.getByText('E2BIG')).toBeInTheDocument();
      expect(screen.queryByText('7')).not.toBeInTheDocument();
    });
  });

  describe('mach_exception meta', () => {
    it('should render the mach exception number', () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        meta: {mach_exception: {exception: 1, subcode: 8, code: 1}},
      };

      render(<Mechanism data={mechanism} />);

      expect(screen.getByText('mach exception')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should prefer the exception name if present', () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        meta: {
          mach_exception: {exception: 1, subcode: 8, code: 1, name: 'EXC_BAD_ACCESS'},
        },
      };

      render(<Mechanism data={mechanism} />);

      expect(screen.getByText('EXC_BAD_ACCESS')).toBeInTheDocument();
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });
  });

  describe('signal meta', () => {
    it('should render the signal number', () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        meta: {signal: {number: 11}},
      };

      render(<Mechanism data={mechanism} />);

      expect(screen.getByText('signal')).toBeInTheDocument();
      expect(screen.getByText('11')).toBeInTheDocument();
    });

    it('should add the signal code if present', () => {
      const mechanism = {
        type: 'generic',
        handled: false,
        meta: {signal: {number: 11, code: 0}},
      };

      render(<Mechanism data={mechanism} />);

      expect(screen.getByText('11 (code 0)')).toBeInTheDocument();
    });

    it('should prefer signal and code names if present', () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        meta: {signal: {number: 11, code: 0, name: 'SIGSEGV', code_name: 'SEGV_NOOP'}},
      };

      render(<Mechanism data={mechanism} />);

      expect(screen.getByText('SIGSEGV (SEGV_NOOP)')).toBeInTheDocument();
    });
  });

  describe('additional data', () => {
    it('should render all fields in the data object', () => {
      const mechanism = {
        type: 'generic',
        handled: false,
        data: {relevant_address: '0x1'},
      };

      render(<Mechanism data={mechanism} />);

      expect(screen.getByText('relevant_address')).toBeInTheDocument();
      expect(screen.getByText('0x1')).toBeInTheDocument();
    });

    it('should skip object-like values', () => {
      const mechanism: StackTraceMechanism = {
        type: 'generic',
        handled: false,
        data: {
          a: {x: 11},
          b: [4, 2],
          c: new Date(),
          d: 'kept',
        },
      };
      render(<Mechanism data={mechanism} />);

      expect(screen.getByText('d')).toBeInTheDocument();
      expect(screen.getByText('kept')).toBeInTheDocument();
      expect(screen.queryByText('a')).not.toBeInTheDocument();
      expect(screen.queryByText('b')).not.toBeInTheDocument();
      expect(screen.queryByText('c')).not.toBeInTheDocument();
    });
  });
});
