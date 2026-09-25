import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DroppedDataLayerControl} from 'sentry/components/droppedData/droppedDataLayerControl';

describe('DroppedDataLayerControl', () => {
  it('hides dropped data when the layer is unchecked', async () => {
    const onChange = jest.fn();
    render(<DroppedDataLayerControl showDroppedData onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));
    await userEvent.click(screen.getByRole('option', {name: 'Dropped Data'}));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('shows dropped data when the layer is checked', async () => {
    const onChange = jest.fn();
    render(<DroppedDataLayerControl showDroppedData={false} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', {name: 'Chart layers'}));
    await userEvent.click(screen.getByRole('option', {name: 'Dropped Data'}));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('describes the control on hover', async () => {
    render(<DroppedDataLayerControl showDroppedData onChange={jest.fn()} />);

    await userEvent.hover(screen.getByRole('button', {name: 'Chart layers'}));

    expect(
      await screen.findByText('Show or hide additional layers on this chart')
    ).toBeInTheDocument();
  });
});
