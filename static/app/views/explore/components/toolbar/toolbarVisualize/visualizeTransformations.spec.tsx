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

  it('adds, configures, switches, and removes independent ordered transformations', async () => {
    render(<Example />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Add Transformation'}));
    await userEvent.click(screen.getByRole('option', {name: 'Fill'}));
    expect(screen.getByRole('status')).toHaveTextContent('["fill(zero)"]');

    await userEvent.click(screen.getByRole('button', {name: 'Fill method'}));
    await userEvent.click(screen.getByRole('option', {name: 'Previous value'}));
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
