import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {DroppedDataLayerControl} from 'sentry/components/droppedData/droppedDataLayerControl';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

describe('DroppedDataLayerControl', () => {
  it('hides dropped data when the layer is unchecked', async () => {
    const onChange = jest.fn();
    render(
      <DroppedDataLayerControl
        dataset={DiscoverDatasets.SPANS}
        hasDroppedData
        showDroppedData
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));
    await userEvent.click(screen.getByRole('option', {name: 'Dropped Spans'}));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('shows dropped data when the layer is checked', async () => {
    const onChange = jest.fn();
    render(
      <DroppedDataLayerControl
        dataset={DiscoverDatasets.SPANS}
        hasDroppedData
        showDroppedData={false}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));
    await userEvent.click(screen.getByRole('option', {name: 'Dropped Spans'}));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('names the layer after the telemetry type', async () => {
    render(
      <DroppedDataLayerControl
        dataset={DiscoverDatasets.OURLOGS}
        hasDroppedData
        showDroppedData={false}
        onChange={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));

    expect(screen.getByRole('option', {name: 'Dropped Logs'})).toBeInTheDocument();
  });

  it('shows a placeholder in the trigger when no layer is selected', () => {
    render(
      <DroppedDataLayerControl
        dataset={DiscoverDatasets.SPANS}
        hasDroppedData
        showDroppedData={false}
        onChange={jest.fn()}
      />
    );

    const trigger = screen.getByRole('button', {name: 'Chart layers'});
    expect(trigger).toHaveTextContent('Layers');
    expect(trigger).not.toHaveTextContent('None');
  });

  it('shows the selected layer in the trigger', () => {
    render(
      <DroppedDataLayerControl
        dataset={DiscoverDatasets.SPANS}
        hasDroppedData
        showDroppedData
        onChange={jest.fn()}
      />
    );

    expect(screen.getByRole('button', {name: 'Chart layers'})).toHaveTextContent(
      'Dropped Spans'
    );
  });

  it('disables the layer and explains why when nothing was dropped', async () => {
    const onChange = jest.fn();
    render(
      <DroppedDataLayerControl
        dataset={DiscoverDatasets.SPANS}
        hasDroppedData={false}
        showDroppedData
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole('button', {name: 'Chart layers'});
    expect(trigger).toHaveTextContent('Layers');

    await userEvent.click(trigger);

    const option = screen.getByRole('option', {name: 'Dropped Spans'});
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(option).toHaveAttribute('aria-selected', 'false');

    await userEvent.hover(within(option).getByText('Dropped Spans'));
    expect(
      await screen.findByText('No significant dropped spans in this time range')
    ).toBeInTheDocument();

    await userEvent.click(option);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('describes the control on hover', async () => {
    render(
      <DroppedDataLayerControl
        dataset={DiscoverDatasets.SPANS}
        hasDroppedData
        showDroppedData
        onChange={jest.fn()}
      />
    );

    await userEvent.hover(screen.getByRole('button', {name: 'Chart layers'}));

    expect(
      await screen.findByText('Show or hide additional layers on this chart')
    ).toBeInTheDocument();
  });
});
