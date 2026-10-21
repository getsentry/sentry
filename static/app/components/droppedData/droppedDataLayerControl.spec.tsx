import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DroppedDataLayerControl} from 'sentry/components/droppedData/droppedDataLayerControl';

describe('DroppedDataLayerControl', () => {
  it('hides dropped data when the layer is unchecked', async () => {
    const onChange = jest.fn();
    render(<DroppedDataLayerControl showDroppedData onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));
    await userEvent.click(screen.getByRole('option', {name: 'Dropped Events'}));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('shows dropped data when the layer is checked', async () => {
    const onChange = jest.fn();
    render(<DroppedDataLayerControl showDroppedData={false} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));
    await userEvent.click(screen.getByRole('option', {name: 'Dropped Events'}));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows a placeholder in the trigger when no layer is selected', () => {
    render(<DroppedDataLayerControl showDroppedData={false} onChange={jest.fn()} />);

    const trigger = screen.getByRole('button', {name: 'Chart layers'});
    expect(trigger).toHaveTextContent('Layers');
    expect(trigger).not.toHaveTextContent('None');
  });

  it('shows the selected layer in the trigger', () => {
    render(<DroppedDataLayerControl showDroppedData onChange={jest.fn()} />);

    expect(screen.getByRole('button', {name: 'Chart layers'})).toHaveTextContent(
      'Dropped Events'
    );
  });

  it('describes the control on hover', async () => {
    render(<DroppedDataLayerControl showDroppedData onChange={jest.fn()} />);

    await userEvent.hover(screen.getByRole('button', {name: 'Chart layers'}));

    expect(
      await screen.findByText('Show or hide additional layers on this chart')
    ).toBeInTheDocument();
  });
});
