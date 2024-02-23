import {fitToValueRect} from 'sentry/views/ddm/chart/chartUtils';

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
