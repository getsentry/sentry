import {useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {TraceItemDataset} from 'sentry/views/explore/types';

import {VisualizeTransformations} from './visualizeTransformations';

function Example({initial = []}: {initial?: string[]}) {
  const [transformations, setTransformations] = useState<readonly string[]>(initial);
  return (
    <div>
      <VisualizeTransformations
        traceItemDataset={TraceItemDataset.SPANS}
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

  it('swaps through either type select without changing settings', async () => {
    render(<Example initial={['fill(linear)', 'smooth(ema, 4, 0.75)']} />, {
      organization,
    });

    const firstRow = screen.getByRole('group', {name: 'Transformation 1'});
    await userEvent.click(
      within(firstRow).getByRole('button', {name: 'Transformation type'})
    );
    await userEvent.click(screen.getByRole('option', {name: 'Smooth'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["smooth(ema, 4, 0.75)","fill(linear)"]'
    );

    const secondRow = screen.getByRole('group', {name: 'Transformation 2'});
    await userEvent.click(
      within(secondRow).getByRole('button', {name: 'Transformation type'})
    );
    await userEvent.click(screen.getByRole('option', {name: 'Smooth'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["fill(linear)","smooth(ema, 4, 0.75)"]'
    );
  });

  it.each([
    {initial: 'fill(linear)', type: 'Smooth', result: 'smooth(sma,3)'},
    {initial: 'smooth(sma,4)', type: 'Fill', result: 'fill(zero)'},
  ])('replaces a lone transformation with $type', async ({initial, type, result}) => {
    render(<Example initial={[initial]} />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Transformation type'}));
    await userEvent.click(screen.getByRole('option', {name: type}));
    expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify([result]));
  });

  it.each([
    {
      initial: 'fill(zero)',
      existing: 'Fill',
      available: 'Smooth',
      added: 'smooth(sma,3)',
    },
    {
      initial: 'smooth(sma,3)',
      existing: 'Smooth',
      available: 'Fill',
      added: 'fill(zero)',
    },
  ])(
    'allows one $existing and one $available',
    async ({initial, existing, available, added}) => {
      render(<Example initial={[initial]} />, {organization});
      await userEvent.click(screen.getByRole('button', {name: 'Add Transformation'}));
      expect(screen.getByRole('option', {name: existing})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      await userEvent.click(screen.getByRole('option', {name: available}));
      expect(screen.getByRole('button', {name: 'Add Transformation'})).toBeDisabled();

      const firstRow = screen.getByRole('group', {name: 'Transformation 1'});
      await userEvent.click(
        within(firstRow).getByRole('button', {name: 'Remove transformation'})
      );
      await userEvent.click(screen.getByRole('button', {name: 'Add Transformation'}));
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
  });

  it('configures Fill and smoothing settings independently', async () => {
    render(<Example />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Add Transformation'}));
    await userEvent.click(screen.getByRole('option', {name: 'Fill'}));
    await userEvent.click(screen.getByRole('button', {name: 'Fill method'}));
    await userEvent.click(screen.getByRole('option', {name: 'LOCF'}));
    await userEvent.click(screen.getByRole('button', {name: 'Add Transformation'}));
    await userEvent.click(screen.getByRole('option', {name: 'Smooth'}));
    await userEvent.click(screen.getByRole('button', {name: 'Window Size'}));
    await userEvent.click(screen.getByRole('option', {name: '1'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["fill(locf)","smooth(sma,1)"]'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Smoothing method'}));
    await userEvent.click(screen.getByRole('option', {name: 'EMA'}));
    await userEvent.click(screen.getByRole('button', {name: 'Smoothing Factor'}));
    await userEvent.click(screen.getByRole('option', {name: '75%'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["fill(locf)","smooth(ema,10,0.75)"]'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Smoothing method'}));
    await userEvent.click(screen.getByRole('option', {name: 'ASAP'}));
    expect(screen.getByRole('button', {name: 'Max Window Size'})).toHaveTextContent('5');
    expect(
      screen.queryByRole('button', {name: 'Smoothing Factor'})
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Max Window Size'}));
    await userEvent.click(screen.getByRole('option', {name: '7'}));
    expect(screen.getByRole('status')).toHaveTextContent(
      '["fill(locf)","smooth(asap,7)"]'
    );
  });

  it.each(['future(x)', 'smooth(sma,20)'])(
    'preserves %s and omitted EMA parameters while editing a sibling',
    async raw => {
      render(<Example initial={[raw, 'smooth(ema,5)']} />, {organization});
      await userEvent.click(screen.getByRole('button', {name: 'Window Size'}));
      await userEvent.click(screen.getByRole('option', {name: '6'}));
      expect(screen.getByRole('status')).toHaveTextContent(
        JSON.stringify([raw, 'smooth(ema,6)'])
      );
    }
  );

  it('restores an automatic ASAP window and allows an explicit value', async () => {
    render(<Example initial={['smooth(asap)']} />, {organization});
    expect(screen.getByRole('button', {name: 'Max Window Size'})).toHaveTextContent(
      'Auto'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Max Window Size'}));
    await userEvent.click(screen.getByRole('option', {name: '3'}));
    expect(screen.getByRole('status')).toHaveTextContent('["smooth(asap,3)"]');
  });

  it('preserves stored transformations while the feature is disabled', () => {
    render(<Example initial={['fill(zero)']} />);
    expect(
      screen.queryByRole('button', {name: 'Add Transformation'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('["fill(zero)"]');
  });
});
