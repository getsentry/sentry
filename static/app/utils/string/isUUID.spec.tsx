import {isUUID} from 'sentry/utils/string/isUUID';

describe('isUUID', () => {
  test('valid UUIDs should return true', () => {
    expect(isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
    expect(isUUID('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(true);
  });

  test('invalid UUIDs should return false', () => {
    expect(isUUID('123e4567e89b12d3a456426614174000')).toBe(false); // Missing hyphens
    expect(isUUID('123e4567-e89b-12d3-a456-42661417400')).toBe(false); // Too short
    expect(isUUID('123e4567-e89b-12d3-a456-42661417400000')).toBe(false); // Too long
    expect(isUUID('g23e4567-e89b-12d3-a456-426614174000')).toBe(false); // Invalid character
    expect(isUUID('123e4567-e89b-12d3-a456-42661417400g')).toBe(false); // Invalid character at end
    expect(isUUID('123e4567-e89b-12d3-a456-42661417400-')).toBe(false); // Hyphen at end
  });

  test('edge cases should return false', () => {
    expect(isUUID('')).toBe(false); // Empty string
    expect(isUUID(' ')).toBe(false); // Space
    expect(isUUID('123e4567-e89b-12d3-a456-426614174000\n')).toBe(false); // Valid UUID with newline
    expect(isUUID('123e4567-e89b-12d3-a456-426614174000 ')).toBe(false); // Valid UUID with trailing space
  });
});
