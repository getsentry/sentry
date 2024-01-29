import {fitToValueRect, isInRect} from 'sentry/views/ddm/chartUtils';

describe('isInRect', () => {
  const rect = {
    top: 0,
    left: 0,
    right: 10,
    bottom: 10,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    toJSON: () => {},
  };

  it('should return false if rect is undefined', () => {
    expect(isInRect(1, 2, undefined)).toBe(false);
  });

  it('should return true if point is within the rect', () => {
    expect(isInRect(5, 5, rect)).toBe(true);
  });

  it('should return false if point is outside the rect', () => {
    expect(isInRect(11, 11, rect)).toBe(false);
  });

  it('should return true if point is exactly on the border of the rect', () => {
    expect(isInRect(0, 0, rect)).toBe(true);
    expect(isInRect(10, 10, rect)).toBe(true);
  });
});

describe('fitToValueRect', () => {
  it('should return original x and y if rect is undefined', () => {
    const x = 5;
    const y = 10;
    const rect = undefined;
    const result = fitToValueRect(x, y, rect);
    expect(result).toEqual([x, y]);
  });

  it('should return original x and y if they are within the value rect', () => {
    const x = 5;
    const y = 10;
    const rect = {xMin: 0, xMax: 10, yMin: 0, yMax: 20};
    const result = fitToValueRect(x, y, rect);
    expect(result).toEqual([x, y]);
  });

  it('should return x as xMin if it is below the minimum xValue', () => {
    const x = -5;
    const y = 10;
    const rect = {xMin: 0, xMax: 10, yMin: 0, yMax: 20};
    const result = fitToValueRect(x, y, rect);
    expect(result).toEqual([rect.xMin, y]);
  });

  it('should return x as xMax if it is above the maximum xValue', () => {
    const x = 15;
    const y = 10;
    const rect = {xMin: 0, xMax: 10, yMin: 0, yMax: 20};
    const result = fitToValueRect(x, y, rect);
    expect(result).toEqual([rect.xMax, y]);
  });

  it('should return y as yMin if it is below the minimum yValue', () => {
    const x = 5;
    const y = -5;
    const rect = {xMin: 0, xMax: 10, yMin: 0, yMax: 20};
    const result = fitToValueRect(x, y, rect);
    expect(result).toEqual([x, rect.yMin]);
  });

  it('should return y as yMax if it is above the maximum yValue', () => {
    const x = 5;
    const y = 25;
    const rect = {xMin: 0, xMax: 10, yMin: 0, yMax: 20};
    const result = fitToValueRect(x, y, rect);
    expect(result).toEqual([x, rect.yMax]);
  });
});
