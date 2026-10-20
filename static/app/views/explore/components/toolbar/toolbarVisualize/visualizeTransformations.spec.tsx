import {useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {VisualizeTransformations} from './visualizeTransformations';

function Example({initial = []}: {initial?: string[]}) {
  const [transformations, setTransformations] = useState<readonly string[]>(initial);
  return (
    <div>
      <VisualizeTransformations
        transformations={transformations}
        onChange={setTransformations}
      />
      <output>{JSON.stringify(transformations)}</output>
    </div>
  );
}

describe('VisualizeTransformations', () => {
  const organization = OrganizationFixture({
    features: ['explore-interpolation-and-smoothing'],
  });

  it.each([
    'smooth(sma,7)',
    'smooth(ema,6,0.75)',
    'smooth(ema,6)',
    'smooth(asap,3)',
    'smooth(asap)',
  ])(
    'swaps Fill and %s through either type select without changing settings',
    async smooth => {
      render(<Example initial={['fill(linear)', smooth]} />, {organization});

      const firstRow = screen.getByRole('group', {name: 'Transformation 1'});
      const secondRow = screen.getByRole('group', {name: 'Transformation 2'});
      await userEvent.click(
        within(firstRow).getByRole('button', {name: 'Transformation type'})
      );
      expect(screen.getByRole('option', {name: 'Fill'})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.getByRole('option', {name: 'Smooth'})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );
      await userEvent.click(screen.getByRole('option', {name: 'Smooth'}));
      expect(screen.getByRole('status')).toHaveTextContent(
        JSON.stringify([smooth, 'fill(linear)'])
      );
      expect(
        within(firstRow).getByRole('button', {name: 'Transformation type'})
      ).toHaveTextContent('Smooth');
      expect(
        within(secondRow).getByRole('button', {name: 'Fill method'})
      ).toHaveTextContent('Linear');
      expect(screen.getByRole('button', {name: 'Add Transformation'})).toBeDisabled();

      await userEvent.click(
        within(secondRow).getByRole('button', {name: 'Transformation type'})
      );
      await userEvent.click(screen.getByRole('option', {name: 'Smooth'}));
      expect(screen.getByRole('status')).toHaveTextContent(
        JSON.stringify(['fill(linear)', smooth])
      );
      expect(
        within(firstRow).getByRole('button', {name: 'Fill method'})
      ).toHaveTextContent('Linear');
    }
  );

  it('switches a lone Fill to Smooth and keeps addition limited to the missing function', async () => {
    render(<Example initial={['fill(linear)']} />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Transformation type'}));
    await userEvent.click(screen.getByRole('option', {name: 'Smooth'}));
    expect(screen.getByRole('status')).toHaveTextContent('["smooth(sma,10)"]');
    await userEvent.click(screen.getByRole('button', {name: 'Add Transformation'}));
    expect(screen.getByRole('option', {name: 'Smooth'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await userEvent.click(screen.getByRole('option', {name: 'Fill'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["smooth(sma,10)","fill(zero)"]'
    );
  });

  it.each([
    {
      initial: 'fill(zero)',
      existing: 'Fill',
      available: 'Smooth',
      added: 'smooth(sma,10)',
    },
    {
      initial: 'smooth(sma,10)',
      existing: 'Smooth',
      available: 'Fill',
      added: 'fill(zero)',
    },
  ])(
    'allows only one $existing and one $available per series',
    async ({initial, existing, available, added}) => {
      render(<Example initial={[initial]} />, {organization});

      await userEvent.click(screen.getByRole('button', {name: 'Add Transformation'}));
      expect(screen.getByRole('option', {name: existing})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.getByRole('option', {name: available})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );
      await userEvent.click(screen.getByRole('option', {name: existing}));
      expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify([initial]));
      await userEvent.click(screen.getByRole('option', {name: available}));
      expect(screen.getByRole('status')).toHaveTextContent(
        JSON.stringify([initial, added])
      );
      expect(screen.getByRole('button', {name: 'Add Transformation'})).toBeDisabled();

      const rows = screen.getAllByRole('group', {name: /Transformation \d/});
      await userEvent.click(
        within(rows[0]!).getByRole('button', {name: 'Transformation type'})
      );
      expect(screen.getByRole('option', {name: existing})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.getByRole('option', {name: available})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );
      await userEvent.click(screen.getByRole('option', {name: available}));
      expect(screen.getByRole('status')).toHaveTextContent(
        JSON.stringify([added, initial])
      );

      await userEvent.click(
        within(rows[1]!).getByRole('button', {name: 'Transformation type'})
      );
      expect(screen.getByRole('option', {name: existing})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.getByRole('option', {name: available})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );
      await userEvent.click(screen.getByRole('option', {name: available}));
      expect(screen.getByRole('status')).toHaveTextContent(
        JSON.stringify([initial, added])
      );

      await userEvent.click(
        within(rows[0]!).getByRole('button', {name: 'Remove transformation'})
      );
      expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify([added]));
      expect(screen.getByRole('button', {name: 'Add Transformation'})).toBeEnabled();
      await userEvent.click(screen.getByRole('button', {name: 'Add Transformation'}));
      expect(screen.getByRole('option', {name: existing})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.getByRole('option', {name: available})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      await userEvent.click(screen.getByRole('option', {name: existing}));
      expect(screen.getByRole('status')).toHaveTextContent(
        JSON.stringify([added, initial])
      );
    }
  );

  it('counts unsupported settings toward function uniqueness', async () => {
    render(<Example initial={['smooth(sma,20)']} />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Add Transformation'}));
    expect(screen.getByRole('option', {name: 'Smooth'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await userEvent.click(screen.getByRole('option', {name: 'Fill'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["smooth(sma,20)","fill(zero)"]'
    );
    expect(screen.getByRole('button', {name: 'Add Transformation'})).toBeDisabled();
  });

  it('adds, configures, switches, and removes independent ordered transformations', async () => {
    render(<Example />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Add Transformation'}));
    await userEvent.click(screen.getByRole('option', {name: 'Fill'}));
    expect(screen.getByRole('status')).toHaveTextContent('["fill(zero)"]');

    await userEvent.click(screen.getByRole('button', {name: 'Fill method'}));
    await userEvent.click(screen.getByRole('option', {name: 'LOCF'}));
    await userEvent.click(screen.getByRole('button', {name: 'Add Transformation'}));
    await userEvent.click(screen.getByRole('option', {name: 'Smooth'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["fill(locf)","smooth(sma,10)"]'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Window Size'}));
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    await userEvent.click(screen.getByRole('option', {name: '1'}));
    await userEvent.click(screen.getByRole('button', {name: 'Smoothing method'}));
    await userEvent.click(screen.getByRole('option', {name: 'EMA'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["fill(locf)","smooth(ema,1,0.25)"]'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Smoothing Factor'}));
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      '5%',
      '25%',
      '50%',
      '75%',
      '100%',
    ]);
    await userEvent.click(screen.getByRole('option', {name: '75%'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["fill(locf)","smooth(ema,1,0.75)"]'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Smoothing method'}));
    await userEvent.click(screen.getByRole('option', {name: 'ASAP'}));
    expect(screen.getByRole('button', {name: 'Max Window Size'})).toHaveTextContent('1');
    expect(
      screen.queryByRole('button', {name: 'Smoothing Factor'})
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Max Window Size'}));
    await userEvent.click(screen.getByRole('option', {name: '10'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["fill(locf)","smooth(asap,10)"]'
    );

    const firstRow = screen.getByRole('group', {name: 'Transformation 1'});
    await userEvent.click(
      within(firstRow).getByRole('button', {name: 'Remove transformation'})
    );
    expect(screen.getByRole('status')).toHaveTextContent('["smooth(asap,10)"]');
    await userEvent.click(screen.getByRole('button', {name: 'Transformation type'}));
    await userEvent.click(screen.getByRole('option', {name: 'Fill'}));
    await userEvent.click(screen.getByRole('button', {name: 'Fill method'}));
    await userEvent.click(screen.getByRole('option', {name: 'Linear'}));
    expect(screen.getByRole('status')).toHaveTextContent('["fill(linear)"]');
    await userEvent.click(screen.getByRole('button', {name: 'Remove transformation'}));
    expect(screen.getByRole('status')).toHaveTextContent('[]');
  });

  it.each([
    ['5%', '0.05'],
    ['25%', '0.25'],
    ['50%', '0.5'],
    ['75%', '0.75'],
    ['100%', '1'],
  ])('encodes the %s factor as a decimal', async (label, factor) => {
    render(<Example initial={['smooth(ema,10)']} />, {organization});
    expect(screen.getByRole('button', {name: 'Smoothing Factor'})).toHaveTextContent(
      'Auto'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Smoothing Factor'}));
    await userEvent.click(screen.getByRole('option', {name: label}));
    expect(screen.getByRole('status')).toHaveTextContent(`["smooth(ema,10,${factor})"]`);
  });

  it('preserves omitted optional parameters, unknown entries, and duplicate rows', async () => {
    render(
      <Example
        initial={[
          'future(x)',
          'smooth(ema,5)',
          'smooth(asap)',
          'fill(zero)',
          'fill(zero)',
        ]}
      />,
      {organization}
    );
    expect(screen.getByText('Unsupported transformation')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Max Window Size'})).toHaveTextContent(
      'Auto'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Window Size'}));
    await userEvent.click(screen.getByRole('option', {name: '6'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["future(x)","smooth(ema,6)","smooth(asap)","fill(zero)","fill(zero)"]'
    );

    const row = screen.getByRole('group', {name: 'Transformation 4'});
    await userEvent.click(within(row).getByRole('button', {name: 'Fill method'}));
    await userEvent.click(screen.getByRole('option', {name: 'Linear'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["future(x)","smooth(ema,6)","smooth(asap)","fill(linear)","fill(zero)"]'
    );
    await userEvent.click(
      within(row).getByRole('button', {name: 'Remove transformation'})
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      '["future(x)","smooth(ema,6)","smooth(asap)","fill(zero)"]'
    );
  });

  it('preserves stored transformations while the feature is disabled', () => {
    render(<Example initial={['fill(zero)']} />);
    expect(
      screen.queryByRole('button', {name: 'Add Transformation'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('["fill(zero)"]');
  });
});
