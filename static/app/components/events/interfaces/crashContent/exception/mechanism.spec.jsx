import {render} from 'sentry-test/reactTestingLibrary';

import {Mechanism} from 'sentry/components/events/interfaces/crashContent/exception/mechanism';

describe('ExceptionMechanism', () => {
  describe('basic attributes', () => {
    it('should render the exception mechanism', () => {
      const mechanism = {type: 'generic'};
      const wrapper = render(<Mechanism data={mechanism} />);
      expect(wrapper.container).toSnapshot();
    });

    it('should render a help_link icon', () => {
      const mechanism = {type: 'generic', help_link: 'https://example.org/help'};
      const wrapper = render(<Mechanism data={mechanism} />);
      expect(wrapper.container).toSnapshot();
    });

    it('should render a description hovercard', () => {
      const mechanism = {type: 'generic', description: 'Nothing to see here.'};
      const wrapper = render(<Mechanism data={mechanism} />);
      expect(wrapper.container).toSnapshot();
    });

    it('should add the help_link to the description hovercard', () => {
      const mechanism = {
        type: 'generic',
        description: 'Nothing to see here.',
        help_link: 'https://example.org/help',
      };
      const wrapper = render(<Mechanism data={mechanism} />);
      expect(wrapper.container).toSnapshot();
    });

    it('should not add the help_link if not starts with http(s)', () => {
      const mechanism = {
        type: 'generic',
        description: 'Nothing to see here.',
        help_link: 'example.org/help',
      };
      const wrapper = render(<Mechanism data={mechanism} />);
      expect(wrapper.container).toSnapshot();
    });

    it('should render the handled pill', () => {
      const mechanism = {type: 'generic', handled: false};
      const {container} = render(<Mechanism data={mechanism} />);
      expect(container).toSnapshot();
    });
  });

  describe('errno meta', () => {
    it('should render the errno number', () => {
      const mechanism = {type: 'generic', meta: {errno: {number: 7}}};
      const wrapper = render(<Mechanism data={mechanism} />);
      expect(wrapper.container).toSnapshot();
    });

    it('should prefer the errno name if present', () => {
      const mechanism = {type: 'generic', meta: {errno: {number: 7, name: 'E2BIG'}}};
      const {container} = render(<Mechanism data={mechanism} />);
      expect(container).toSnapshot();
    });
  });

  describe('mach_exception meta', () => {
    it('should render the mach exception number', () => {
      const mechanism = {
        type: 'generic',
        meta: {mach_exception: {exception: 1, subcode: 8, code: 1}},
      };
      const {container} = render(<Mechanism data={mechanism} />);
      expect(container).toSnapshot();
    });

    it('should prefer the exception name if present', () => {
      const mechanism = {
        type: 'generic',
        meta: {
          mach_exception: {exception: 1, subcode: 8, code: 1, name: 'EXC_BAD_ACCESS'},
        },
      };
      const {container} = render(<Mechanism data={mechanism} />);
      expect(container).toSnapshot();
    });
  });

  describe('signal meta', () => {
    it('should render the signal number', () => {
      const mechanism = {type: 'generic', meta: {signal: {number: 11}}};
      const {container} = render(<Mechanism data={mechanism} />);
      expect(container).toSnapshot();
    });

    it('should add the signal code if present', () => {
      const mechanism = {type: 'generic', meta: {signal: {number: 11, code: 0}}};
      const {container} = render(<Mechanism data={mechanism} />);
      expect(container).toSnapshot();
    });

    it('should prefer signal and code names if present', () => {
      const mechanism = {
        type: 'generic',
        meta: {signal: {number: 11, code: 0, name: 'SIGSEGV', code_name: 'SEGV_NOOP'}},
      };
      const {container} = render(<Mechanism data={mechanism} />);
      expect(container).toSnapshot();
    });
  });

  describe('additional data', () => {
    it('should render all fields in the data object', () => {
      const mechanism = {type: 'generic', data: {relevant_address: '0x1'}};
      const {container} = render(<Mechanism data={mechanism} />);
      expect(container).toSnapshot();
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
      const wrapper = render(<Mechanism data={mechanism} />);
      expect(wrapper.container).toSnapshot();
    });
  });
});
