import {structuralSharing} from './useStructuralSharing';

describe('structuralSharing', () => {
  it('should return the same object if nothing changed', () => {
    const obj = {a: 1, b: 2};
    expect(structuralSharing(obj, {...obj})).toBe(obj);
  });

  it('should return a new object if something changed', () => {
    const obj = {a: 1, b: 2};
    expect(structuralSharing(obj, {...obj, a: 2})).not.toBe(obj);
    expect(structuralSharing(obj, {...obj, a: 2})).toEqual({a: 2, b: 2});
  });

  it('should return the same array if nothing changed', () => {
    const arr = [1, 2, 3];
    expect(structuralSharing(arr, [...[1, 2, 3]])).toBe(arr);
  });

  it('should remove array elements', () => {
    const arr = [1, 2, 3];
    expect(structuralSharing(arr, [1, 2])).not.toBe(arr);
    expect(structuralSharing(arr, [1, 2])).toEqual([1, 2]);
  });

  it('should return a new array if something changed', () => {
    const arr = [1, 2, 3];
    expect(structuralSharing(arr, [...[1, 2, 4]])).not.toBe(arr);
    expect(structuralSharing(arr, [...[1, 2, 4]])).toEqual([1, 2, 4]);
  });

  it('should handle changes in nested objects', () => {
    const obj = {a: {b: 1}, c: {d: 2}};
    const newObj = structuralSharing(obj, {...obj, a: {b: 2}});
    expect(newObj).toEqual({a: {b: 2}, c: {d: 2}});
    expect(newObj).not.toBe(obj);
    expect(newObj.a).not.toBe(obj.a);
    expect(newObj.a.b).toBe(2);
    expect(newObj.c).toBe(obj.c);
  });

  it('should handle changes in nested arrays', () => {
    const arr = [{a: 1}, {b: 2}];
    const newArr = structuralSharing(arr, [arr[0], {b: 3}, {c: 4}]);
    expect(newArr).toEqual([{a: 1}, {b: 3}, {c: 4}]);
    expect(newArr).not.toBe(arr);
    expect(newArr[0]).toBe(arr[0]);
    expect(newArr[1]).not.toBe(arr[1]);
    expect(newArr[2]).not.toBe(arr[2]);
  });
});
