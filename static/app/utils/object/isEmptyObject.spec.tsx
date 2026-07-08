import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';

describe('isEmptyObject', () => {
  it('checks own enumerable object properties', () => {
    expect(isEmptyObject()).toBe(true);
    expect(isEmptyObject({})).toBe(true);
    expect(isEmptyObject({key: 'value'})).toBe(false);
  });

  it('ignores inherited properties', () => {
    const objectWithInheritedProperty = Object.create({inherited: true});

    expect(isEmptyObject(objectWithInheritedProperty)).toBe(true);

    objectWithInheritedProperty.own = true;

    expect(isEmptyObject(objectWithInheritedProperty)).toBe(false);
  });

  it('supports null-prototype objects', () => {
    const object = Object.create(null);

    expect(isEmptyObject(object)).toBe(true);

    object.key = 'value';

    expect(isEmptyObject(object)).toBe(false);
  });
});
