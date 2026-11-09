import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {StackTraceMechanism} from 'sentry/types/stacktrace';

import {Mechanism} from './mechanism';

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
    it.each([
      [{number: 7}, '7', undefined],
      [{number: 7, name: 'E2BIG'}, 'E2BIG', '7'],
    ])('should render errno %o as %s', (errno, expected, hidden) => {
      render(<Mechanism data={{type: 'generic', handled: false, meta: {errno}}} />);

      expect(screen.getByText('errno')).toBeInTheDocument();
      expect(screen.getByText(expected)).toBeInTheDocument();
      if (hidden) {
        expect(screen.queryByText(hidden)).not.toBeInTheDocument();
      }
    });
  });

  describe('mach_exception meta', () => {
    it.each([
      [{exception: 1, subcode: 8, code: 1}, '1', undefined],
      [
        {exception: 1, subcode: 8, code: 1, name: 'EXC_BAD_ACCESS'},
        'EXC_BAD_ACCESS',
        '1',
      ],
    ])('should render mach exception %o as %s', (mach_exception, expected, hidden) => {
      render(
        <Mechanism data={{type: 'generic', handled: false, meta: {mach_exception}}} />
      );

      expect(screen.getByText('mach exception')).toBeInTheDocument();
      expect(screen.getByText(expected)).toBeInTheDocument();
      if (hidden) {
        expect(screen.queryByText(hidden)).not.toBeInTheDocument();
      }
    });
  });

  describe('signal meta', () => {
    it.each([
      [{number: 11}, '11'],
      [{number: 11, code: 0}, '11 (code 0)'],
      [
        {number: 11, code: 0, name: 'SIGSEGV', code_name: 'SEGV_NOOP'},
        'SIGSEGV (SEGV_NOOP)',
      ],
    ])('should render signal %o as %s', (signal, expected) => {
      render(<Mechanism data={{type: 'generic', handled: false, meta: {signal}}} />);

      expect(screen.getByText('signal')).toBeInTheDocument();
      expect(screen.getByText(expected)).toBeInTheDocument();
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
