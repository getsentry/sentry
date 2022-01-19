import {Rect, Transform} from 'sentry/utils/profiling/gl/utils';
import {
  computeInterval,
  getIntervalTimeAtX,
} from 'sentry/utils/profiling/renderers/gridRenderer';

describe('getIntervalTimeAtX', () => {
  it('when origin is at 0', () => {
    const configView = new Rect(0, 0, 10, 10);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(getIntervalTimeAtX(configToPhysical, 500)).toBe(5);
  });
  it('when origin is offset', () => {
    const configView = new Rect(5, 0, 10, 10);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(getIntervalTimeAtX(configToPhysical, 500)).toBe(10);
  });
});

describe('computeInterval', () => {
  it('computes intervals when origin is 0', () => {
    const configView = new Rect(0, 0, 100, 100);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(computeInterval(configView, configToPhysical)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });
  it('computes intervals when origin is offset', () => {
    const configView = new Rect(50, 0, 50, 100);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(computeInterval(configView, configToPhysical)).toEqual([
      50, 60, 70, 80, 90, 100,
    ]);
  });
  it('readjust intervals *5 when they are too small', () => {
    const configView = new Rect(60, 0, 40, 100);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(computeInterval(configView, configToPhysical)).toEqual([
      60, 65, 70, 75, 80, 85, 90, 95, 100,
    ]);
  });
  it('readjust intervals *2 when they are too small', () => {
    const configView = new Rect(80, 0, 20, 100);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(computeInterval(configView, configToPhysical)).toEqual([
      80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100,
    ]);
  });
  it('supports fractions', () => {
    const configView = new Rect(0, 0, 3, 100);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(computeInterval(configView, configToPhysical)).toEqual([
      0, 0.5, 1, 1.5, 2, 2.5, 3,
    ]);
  });
});
