import {isNativePlatform} from './platform';

describe('isNativePlatform', () => {
  test('returns true for native platforms', () => {
    expect(isNativePlatform('c')).toBe(true);
    expect(isNativePlatform('cocoa')).toBe(true);
    expect(isNativePlatform('objc')).toBe(true);
    expect(isNativePlatform('swift')).toBe(true);
    expect(isNativePlatform('native')).toBe(true);
    expect(isNativePlatform('nintendo-switch')).toBe(true);
    expect(isNativePlatform('playstation')).toBe(true);
    expect(isNativePlatform('xbox')).toBe(true);
  });

  test('returns false for non-native platforms', () => {
    expect(isNativePlatform('java')).toBe(false);
    expect(isNativePlatform('java-android')).toBe(false);
    expect(isNativePlatform('java-spring')).toBe(false);
    expect(isNativePlatform('kotlin')).toBe(false);
    expect(isNativePlatform('javascript')).toBe(false);
    expect(isNativePlatform('javascript-react')).toBe(false);
    expect(isNativePlatform('node')).toBe(false);
    expect(isNativePlatform('node-express')).toBe(false);
    expect(isNativePlatform('python')).toBe(false);
    expect(isNativePlatform('ruby')).toBe(false);
    expect(isNativePlatform('php')).toBe(false);
    expect(isNativePlatform('dart')).toBe(false);
    expect(isNativePlatform('flutter')).toBe(false);
    expect(isNativePlatform('elixir')).toBe(false);
    expect(isNativePlatform('csharp')).toBe(false);
    expect(isNativePlatform('dotnet')).toBe(false);
  });

  test('returns false for undefined or empty string', () => {
    expect(isNativePlatform(undefined)).toBe(false);
    expect(isNativePlatform('')).toBe(false);
  });

  test('handles mixed stacktraces correctly', () => {
    // Mixed stacktraces (e.g., Android NDK) may have different platform values
    // Event platform might be 'java-android', but individual frames have 'native' or 'java'
    expect(isNativePlatform('java-android')).toBe(false); // Event platform
    expect(isNativePlatform('native')).toBe(true); // Native frame
    expect(isNativePlatform('java')).toBe(false); // Java frame
    expect(isNativePlatform('kotlin')).toBe(false); // Kotlin frame

    // Other non-native platforms that might appear in frames
    expect(isNativePlatform('javascript')).toBe(false);
  });
});
