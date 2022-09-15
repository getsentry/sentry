import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FrameRegisters} from 'sentry/components/events/interfaces/frame/frameRegisters';
import {FrameRegisterValue} from 'sentry/components/events/interfaces/frame/frameRegisters/value';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

function TestComponent({children}: {children: React.ReactNode}) {
  const {organization, router} = initializeOrg();

  return (
    <OrganizationContext.Provider value={organization}>
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: {},
          routes: [],
        }}
      >
        {children}
      </RouteContext.Provider>
    </OrganizationContext.Provider>
  );
}

describe('FrameRegisters', function () {
  it('should render registers', function () {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: '0xffffffffffffffff',
      r12: '0x0000000000000000',
    };

    const {container} = render(
      <TestComponent>
        <FrameRegisters registers={registers} />
      </TestComponent>
    );
    expect(container).toSnapshot();
  });

  it('should skip registers without a value', function () {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: null,
      r12: '0x0000000000000000',
    };

    const {container} = render(
      <TestComponent>
        <FrameRegisters registers={registers} />
      </TestComponent>
    );
    expect(container).toSnapshot();
  });
});

describe('FrameRegistersValue', function () {
  const hexadecimalValue = '0x000000000000000a';
  const numericValue = 10;

  describe('with string value', function () {
    it('should display the hexadecimal value', function () {
      render(
        <TestComponent>
          <FrameRegisterValue value={hexadecimalValue} />
        </TestComponent>
      );
      expect(screen.getByText(hexadecimalValue)).toBeInTheDocument();
    });

    it('should display the numeric value', function () {
      render(
        <TestComponent>
          <FrameRegisterValue value={hexadecimalValue} />
        </TestComponent>
      );
      userEvent.click(screen.getByLabelText('Toggle register value format'));
      expect(screen.queryByText(hexadecimalValue)).not.toBeInTheDocument();
      expect(screen.getByText(numericValue)).toBeInTheDocument();
    });
  });

  describe('with numeric value', function () {
    it('should display the hexadecimal value', function () {
      render(
        <TestComponent>
          <FrameRegisterValue value={numericValue} />
        </TestComponent>
      );
      expect(screen.getByText(hexadecimalValue)).toBeInTheDocument();
    });

    it('should display the numeric value', function () {
      render(
        <TestComponent>
          <FrameRegisterValue value={numericValue} />
        </TestComponent>
      );
      userEvent.click(screen.getByLabelText('Toggle register value format'));
      expect(screen.queryByText(hexadecimalValue)).not.toBeInTheDocument();
      expect(screen.getByText(numericValue)).toBeInTheDocument();
    });
  });

  describe('with unknown value', function () {
    const unknownValue = 'xyz';

    it('should display the hexadecimal value', function () {
      render(
        <TestComponent>
          <FrameRegisterValue value={unknownValue} />
        </TestComponent>
      );
      expect(screen.getByText(unknownValue)).toBeInTheDocument();
    });

    it('should display the numeric value', function () {
      render(
        <TestComponent>
          <FrameRegisterValue value={unknownValue} />
        </TestComponent>
      );
      userEvent.click(screen.getByLabelText('Toggle register value format'));
      expect(screen.getByText(unknownValue)).toBeInTheDocument();
    });
  });
});
