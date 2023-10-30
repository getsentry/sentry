import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Slider} from 'sentry/components/slider';

describe('Slider', function () {
  it('renders', function () {
    render(<Slider label="Test" min={0} max={10} step={1} defaultValue={5} />);

    expect(screen.getByRole('group', {name: 'Test'})).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('5'); // <output /> element

    const slider = screen.getByRole('slider', {name: 'Test'});
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue('5');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '10');
  });

  it('renders without label/output', function () {
    render(<Slider aria-label="Test" min={0} max={10} step={1} defaultValue={5} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('calls onChange/onChangeEnd', async function () {
    const onChangeMock = jest.fn();
    const onChangeEndMock = jest.fn();
    render(
      <Slider
        label="Test"
        min={5}
        max={10}
        defaultValue={5}
        onChange={onChangeMock}
        onChangeEnd={onChangeEndMock}
      />
    );

    // To focus on the slider, we should call the focus() method. The slider input element
    // is visually hidden and only rendered for screen-reader & keyboard accessibility —
    // users can't actually click on it.
    screen.getByRole('slider', {name: 'Test'}).focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(onChangeMock).toHaveBeenCalledWith(6);
    // onChangeEnd is called after the user stops dragging, but we can't simulate mouse
    // drags with RTL. Here we're just checking that it's called after a key press.
    expect(onChangeEndMock).toHaveBeenCalledWith(6);
  });

  it('works with larger step size', async function () {
    const onChangeEndMock = jest.fn();
    render(
      <Slider
        label="Test"
        min={0}
        max={10}
        step={5}
        defaultValue={5}
        onChangeEnd={onChangeEndMock}
      />
    );

    // To focus on the slider, we should call the focus() method. The slider input element
    // is visually hidden and only rendered for screen-reader & keyboard accessibility —
    // users can't actually click on it.
    screen.getByRole('slider', {name: 'Test'}).focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(onChangeEndMock).toHaveBeenCalledWith(10);
  });

  it('supports advanced keyboard navigation', async function () {
    const onChangeEndMock = jest.fn();
    render(
      <Slider
        label="Test"
        min={5}
        max={100}
        defaultValue={5}
        onChangeEnd={onChangeEndMock}
      />
    );

    // To focus on the slider, we should call the focus() method. The slider input element
    // is visually hidden and only rendered for screen-reader & keyboard accessibility —
    // users can't actually click on it.
    screen.getByRole('slider', {name: 'Test'}).focus();

    // Pressing Arrow Right/Left increases/decreases value by 1
    await userEvent.keyboard('{ArrowRight}');
    expect(onChangeEndMock).toHaveBeenCalledWith(6);
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChangeEndMock).toHaveBeenCalledWith(5);

    // Pressing Arrow Right/Left while holding Shift increases/decreases value by 10
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(onChangeEndMock).toHaveBeenCalledWith(15);
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(onChangeEndMock).toHaveBeenCalledWith(5);

    // Pressing Page Up/Down increases/decreases value by 10
    await userEvent.keyboard('{PageUp}');
    expect(onChangeEndMock).toHaveBeenCalledWith(6);
    await userEvent.keyboard('{PageDown}');
    expect(onChangeEndMock).toHaveBeenCalledWith(5);

    // Pressing Home/End moves value to the min/max position
    await userEvent.keyboard('{Home}');
    expect(onChangeEndMock).toHaveBeenCalledWith(5);
    await userEvent.keyboard('{End}');
    expect(onChangeEndMock).toHaveBeenCalledWith(100);
  });

  it('works with two thumbs', async function () {
    const onChangeEndMock = jest.fn();
    render(
      <Slider
        label="Test"
        min={5}
        max={10}
        defaultValue={[6, 8]}
        onChangeEnd={onChangeEndMock}
      />
    );

    const sliders = screen.getAllByRole('slider', {name: 'Test'});

    // First slider
    await userEvent.tab();
    expect(sliders[0]).toHaveFocus();
    expect(sliders[0]).toHaveValue('6');
    expect(sliders[0]).toHaveAttribute('min', '5');
    expect(sliders[0]).toHaveAttribute('max', '8'); // can't go above second slider's value

    await userEvent.keyboard('{ArrowRight}');
    expect(onChangeEndMock).toHaveBeenCalledWith([7, 8]);

    // Second slider
    await userEvent.tab();
    expect(sliders[1]).toHaveFocus();
    expect(sliders[1]).toHaveValue('8');
    expect(sliders[1]).toHaveAttribute('min', '7'); // can't go below first slider's value
    expect(sliders[1]).toHaveAttribute('max', '10');

    await userEvent.keyboard('{ArrowRight}');
    expect(onChangeEndMock).toHaveBeenCalledWith([7, 9]);
  });
});
