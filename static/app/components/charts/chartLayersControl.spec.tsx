import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ChartLayersControl, type ChartLayer} from './chartLayersControl';

const RELEASES: ChartLayer = {value: 'releases', label: 'Releases', selected: true};
const DROPPED_SPANS: ChartLayer = {
  value: 'dropped-data',
  label: 'Dropped Spans',
  selected: false,
};

describe('ChartLayersControl', () => {
  it('reports the layer that was toggled', async () => {
    const onChange = jest.fn();
    render(<ChartLayersControl layers={[RELEASES, DROPPED_SPANS]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));
    await userEvent.click(screen.getByRole('option', {name: 'Releases'}));
    expect(onChange).toHaveBeenLastCalledWith('releases', false);

    await userEvent.click(screen.getByRole('option', {name: 'Dropped Spans'}));
    expect(onChange).toHaveBeenLastCalledWith('dropped-data', true);
  });

  it('disables a layer and explains why', async () => {
    const onChange = jest.fn();
    render(
      <ChartLayersControl
        layers={[{...DROPPED_SPANS, disabled: true, tooltip: 'Nothing was dropped'}]}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));
    const option = screen.getByRole('option', {name: 'Dropped Spans'});
    expect(option).toHaveAttribute('aria-disabled', 'true');

    await userEvent.hover(within(option).getByText('Dropped Spans'));
    expect(await screen.findByText('Nothing was dropped')).toBeInTheDocument();

    await userEvent.click(option);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('names the selected layer in the trigger, or shows a placeholder', () => {
    const {rerender} = render(
      <ChartLayersControl layers={[RELEASES, DROPPED_SPANS]} onChange={jest.fn()} />
    );
    expect(screen.getByRole('button', {name: 'Chart layers'})).toHaveTextContent(
      'Releases'
    );

    rerender(
      <ChartLayersControl
        layers={[{...RELEASES, selected: false}, DROPPED_SPANS]}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByRole('button', {name: 'Chart layers'})).toHaveTextContent(
      'Layers'
    );
  });

  it('shows only the icon with the icon trigger', () => {
    render(
      <ChartLayersControl
        triggerLabel="icon"
        layers={[RELEASES, DROPPED_SPANS]}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByRole('button', {name: 'Chart layers'})).toHaveTextContent(/^$/);
  });
});
