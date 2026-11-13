import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ChartLayersControl, type ChartLayer} from './chartLayersControl';

const RELEASES: ChartLayer = {value: 'releases', label: 'Releases', selected: true};
const DROPPED_SPANS: ChartLayer = {
  value: 'dropped-data',
  label: 'Dropped Spans',
  selected: false,
};

describe('ChartLayersControl', () => {
  it('lists every layer and marks the selected ones', async () => {
    render(
      <ChartLayersControl layers={[RELEASES, DROPPED_SPANS]} onChange={jest.fn()} />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));

    expect(screen.getByRole('option', {name: 'Releases'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', {name: 'Dropped Spans'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('reports the layer that was turned off', async () => {
    const onChange = jest.fn();
    render(<ChartLayersControl layers={[RELEASES, DROPPED_SPANS]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));
    await userEvent.click(screen.getByRole('option', {name: 'Releases'}));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('releases', false);
  });

  it('reports the layer that was turned on', async () => {
    const onChange = jest.fn();
    render(<ChartLayersControl layers={[RELEASES, DROPPED_SPANS]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));
    await userEvent.click(screen.getByRole('option', {name: 'Dropped Spans'}));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('dropped-data', true);
  });

  it('disables a layer and explains why', async () => {
    const onChange = jest.fn();
    render(
      <ChartLayersControl
        layers={[
          RELEASES,
          {...DROPPED_SPANS, disabled: true, tooltip: 'Nothing was dropped'},
        ]}
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

  describe('selected trigger', () => {
    it('shows a placeholder when no layer is selected', () => {
      render(
        <ChartLayersControl
          layers={[{...RELEASES, selected: false}, DROPPED_SPANS]}
          onChange={jest.fn()}
        />
      );

      const trigger = screen.getByRole('button', {name: 'Chart layers'});
      expect(trigger).toHaveTextContent('Layers');
      expect(trigger).not.toHaveTextContent('None');
    });

    it('names the selected layer', () => {
      render(
        <ChartLayersControl layers={[RELEASES, DROPPED_SPANS]} onChange={jest.fn()} />
      );

      expect(screen.getByRole('button', {name: 'Chart layers'})).toHaveTextContent(
        'Releases'
      );
    });

    it('counts additional selected layers', () => {
      render(
        <ChartLayersControl
          layers={[RELEASES, {...DROPPED_SPANS, selected: true}]}
          onChange={jest.fn()}
        />
      );

      const trigger = screen.getByRole('button', {name: 'Chart layers'});
      expect(trigger).toHaveTextContent('Releases');
      expect(trigger).toHaveTextContent('+1');
    });
  });

  describe('icon trigger', () => {
    it('shows no text, whatever is selected', () => {
      const {rerender} = render(
        <ChartLayersControl
          triggerLabel="icon"
          layers={[RELEASES, DROPPED_SPANS]}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByRole('button', {name: 'Chart layers'})).toHaveTextContent(/^$/);

      rerender(
        <ChartLayersControl
          triggerLabel="icon"
          layers={[{...RELEASES, selected: false}, DROPPED_SPANS]}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByRole('button', {name: 'Chart layers'})).toHaveTextContent(/^$/);
    });

    it('still opens the menu', async () => {
      const onChange = jest.fn();
      render(
        <ChartLayersControl
          triggerLabel="icon"
          layers={[RELEASES, DROPPED_SPANS]}
          onChange={onChange}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));
      await userEvent.click(screen.getByRole('option', {name: 'Dropped Spans'}));

      expect(onChange).toHaveBeenCalledWith('dropped-data', true);
    });
  });

  it('describes the control on hover', async () => {
    render(<ChartLayersControl layers={[RELEASES]} onChange={jest.fn()} />);

    await userEvent.hover(screen.getByRole('button', {name: 'Chart layers'}));

    expect(
      await screen.findByText('Show or hide additional layers on this chart')
    ).toBeInTheDocument();
  });
});
