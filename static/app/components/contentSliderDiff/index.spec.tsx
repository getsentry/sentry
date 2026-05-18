import {useRef} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as useDimensions from 'sentry/utils/useDimensions';

import {ContentSliderDiff} from '.';

function renderContentSliderDiff() {
  return render(
    <ContentSliderDiff.Body
      before={<div>Before Content</div>}
      after={<div>After Content</div>}
    />
  );
}

function getSliderStyleProperty(property: string) {
  return parseFloat(
    screen.getByTestId('drag-handle').parentElement!.style.getPropertyValue(property)
  );
}

function getDividerProgress() {
  return getSliderStyleProperty('--divider-progress');
}

function createRect({
  width,
  height,
  left = 0,
}: {
  height: number;
  width: number;
  left?: number;
}) {
  return {
    bottom: height,
    height,
    left,
    right: left + width,
    top: 0,
    width,
    x: left,
    y: 0,
    toJSON: () => ({}),
  };
}

function mockElementRect({width, height}: {height: number; width: number}) {
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue(createRect({width, height}));
}

function mockImageWrappingLayout(sizes: {
  containerWidth: number;
  height: number;
  imageWidth: number;
}) {
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      if (this.dataset.testId === 'visual-container') {
        return createRect({
          width: sizes.containerWidth,
          height: sizes.height,
          left: 0,
        });
      }
      return createRect({
        width: sizes.imageWidth,
        height: sizes.height,
        left: (sizes.containerWidth - sizes.imageWidth) / 2,
      });
    });
}

function ContentSliderDiffWithVisualContainer(
  props: Omit<React.ComponentProps<typeof ContentSliderDiff.Body>, 'visualContainerRef'>
) {
  const visualRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={visualRef} data-test-id="visual-container">
      <ContentSliderDiff.Body {...props} visualContainerRef={visualRef} />
    </div>
  );
}

function getOuterDividerPosition() {
  return parseFloat(
    screen.getByTestId('visual-container').style.getPropertyValue('--divider-position')
  );
}

async function setDividerPosition(x: number) {
  const target = screen.getByTestId('drag-handle');
  await userEvent.pointer([
    {keys: '[MouseLeft>]', target, coords: {x, y: 5}},
    {keys: '[/MouseLeft]', target, coords: {x, y: 5}},
  ]);
}

describe('ContentSliderDiff', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('divider can be dragged', async () => {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 300, height: 300});

    const mockDragHandleMouseDown = jest.fn();

    render(
      <ContentSliderDiff.Body
        before={<div>Before Content</div>}
        after={<div>After Content</div>}
        onDragHandleMouseDown={mockDragHandleMouseDown}
      />
    );

    const dragHandle = screen.getByTestId('drag-handle');

    await userEvent.pointer([
      {keys: '[MouseLeft>]', target: dragHandle, coords: {x: 0, y: 5}},
      {target: dragHandle, coords: {x: 10, y: 5}},
      {keys: '[/MouseLeft]', target: dragHandle, coords: {x: 10, y: 5}},
    ]);

    expect(mockDragHandleMouseDown).toHaveBeenCalledTimes(1);
  });

  it('does not render content when dimensions are zero', () => {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 0, height: 0});

    renderContentSliderDiff();

    expect(screen.queryByTestId('before-content')).not.toBeInTheDocument();
  });

  it('preserves the default centered divider position when resized', () => {
    const useDimensionsSpy = jest.spyOn(useDimensions, 'useDimensions');
    useDimensionsSpy.mockReturnValue({width: 300, height: 300});

    const {rerender} = renderContentSliderDiff();

    expect(getDividerProgress()).toBeCloseTo(0.5);

    useDimensionsSpy.mockReturnValue({width: 600, height: 300});
    rerender(
      <ContentSliderDiff.Body
        before={<div>Before Content</div>}
        after={<div>After Content</div>}
      />
    );

    expect(getDividerProgress()).toBeCloseTo(0.5);
  });

  it('preserves a user-set container-relative divider position when resized', async () => {
    const useDimensionsSpy = jest.spyOn(useDimensions, 'useDimensions');
    useDimensionsSpy.mockReturnValue({width: 300, height: 300});
    mockElementRect({width: 300, height: 300});

    const {rerender} = renderContentSliderDiff();

    await setDividerPosition(210);

    expect(getDividerProgress()).toBeCloseTo(0.7);

    useDimensionsSpy.mockReturnValue({width: 600, height: 300});
    rerender(
      <ContentSliderDiff.Body
        before={<div>Before Content</div>}
        after={<div>After Content</div>}
      />
    );

    expect(getDividerProgress()).toBeCloseTo(0.7);
  });

  it('projects an image-relative divider position onto the outer container when resized', async () => {
    const useDimensionsSpy = jest.spyOn(useDimensions, 'useDimensions');
    const sizes = {containerWidth: 400, imageWidth: 200, height: 300};
    useDimensionsSpy.mockReturnValue({width: sizes.imageWidth, height: sizes.height});
    mockImageWrappingLayout(sizes);

    const {rerender} = render(
      <ContentSliderDiffWithVisualContainer
        before={<img src="before.png" alt="Before content" />}
        after={<img src="after.png" alt="After content" />}
      />
    );

    await setDividerPosition(240);

    expect(getDividerProgress()).toBeCloseTo(0.7);
    expect(getOuterDividerPosition()).toBeCloseTo(240);

    sizes.containerWidth = 800;
    sizes.imageWidth = 400;
    useDimensionsSpy.mockReturnValue({width: sizes.imageWidth, height: sizes.height});
    rerender(
      <ContentSliderDiffWithVisualContainer
        before={<img src="before.png" alt="Before content" />}
        after={<img src="after.png" alt="After content" />}
      />
    );

    expect(getDividerProgress()).toBeCloseTo(0.7);
    expect(getOuterDividerPosition()).toBeCloseTo(480);
  });

  it('preserves a user-set divider position when resized through zero width', async () => {
    const useDimensionsSpy = jest.spyOn(useDimensions, 'useDimensions');
    useDimensionsSpy.mockReturnValue({width: 300, height: 300});
    mockElementRect({width: 300, height: 300});

    const {rerender} = renderContentSliderDiff();

    await setDividerPosition(210);

    expect(getDividerProgress()).toBeCloseTo(0.7);

    useDimensionsSpy.mockReturnValue({width: 0, height: 0});
    rerender(
      <ContentSliderDiff.Body
        before={<div>Before Content</div>}
        after={<div>After Content</div>}
      />
    );

    expect(screen.queryByTestId('before-content')).not.toBeInTheDocument();

    useDimensionsSpy.mockReturnValue({width: 600, height: 300});
    rerender(
      <ContentSliderDiff.Body
        before={<div>Before Content</div>}
        after={<div>After Content</div>}
      />
    );

    expect(getDividerProgress()).toBeCloseTo(0.7);
  });

  it('preserves left boundary intent when resized', async () => {
    const useDimensionsSpy = jest.spyOn(useDimensions, 'useDimensions');
    useDimensionsSpy.mockReturnValue({width: 300, height: 300});
    mockElementRect({width: 300, height: 300});

    const {rerender} = renderContentSliderDiff();

    await setDividerPosition(-20);

    expect(getDividerProgress()).toBeCloseTo(0);

    useDimensionsSpy.mockReturnValue({width: 600, height: 300});
    rerender(
      <ContentSliderDiff.Body
        before={<div>Before Content</div>}
        after={<div>After Content</div>}
      />
    );

    expect(getDividerProgress()).toBeCloseTo(0);
  });

  it('preserves right boundary intent when resized', async () => {
    const useDimensionsSpy = jest.spyOn(useDimensions, 'useDimensions');
    useDimensionsSpy.mockReturnValue({width: 300, height: 300});
    mockElementRect({width: 300, height: 300});

    const {rerender} = renderContentSliderDiff();

    await setDividerPosition(400);

    expect(getDividerProgress()).toBeCloseTo(1);

    useDimensionsSpy.mockReturnValue({width: 600, height: 300});
    rerender(
      <ContentSliderDiff.Body
        before={<div>Before Content</div>}
        after={<div>After Content</div>}
      />
    );

    expect(getDividerProgress()).toBeCloseTo(1);
  });
});
