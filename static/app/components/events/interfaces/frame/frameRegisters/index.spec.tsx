import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FrameRegisters} from 'sentry/components/events/interfaces/frame/frameRegisters';

describe('FrameRegisters', () => {
  const defaultProps = {
    deviceArch: undefined,
    meta: undefined,
  };
  it('renders defined registers and skips registers without a value', () => {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: null,
      r12: '0x0000000000000000',
    };

    render(<FrameRegisters {...defaultProps} registers={registers} />);
    expect(screen.getByText('Registers')).toBeInTheDocument();
    expect(screen.getByText('r10')).toBeInTheDocument();
    expect(screen.getByText('0x00007fff9300bf70')).toBeInTheDocument();
    expect(screen.queryByText('r11')).not.toBeInTheDocument();
  });

  it('changes every register and copies the displayed value', async () => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });

    const registers = {
      r0: '0x000000000000000a',
      r1: '0x000000000000000b',
    };

    render(<FrameRegisters {...defaultProps} registers={registers} />);
    await userEvent.click(screen.getByRole('radio', {name: 'Decimal'}));

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole('button', {name: 'Copy register value to clipboard'})[0]!
    );

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('10');
  });

  it('renders an unknown register value unchanged', () => {
    render(<FrameRegisters {...defaultProps} registers={{custom: 'xyz'}} />);

    expect(screen.getByText('xyz')).toBeInTheDocument();
  });

  it('does not offer to copy an annotated register value', () => {
    render(
      <FrameRegisters
        {...defaultProps}
        registers={{r0: '0x000000000000000a', r1: ''}}
        meta={{
          r1: {
            '': {
              chunks: [{type: 'redaction', text: '', rule_id: 'project:0'}],
              len: 16,
              rem: [['project:0', 's', 0, 0]],
            },
          },
        }}
      />
    );

    expect(screen.getByText(/redacted/)).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', {name: 'Copy register value to clipboard'})
    ).toHaveLength(1);
  });
});
