import {
  hasFileExtension,
  shouldDisplayAbsPathInTitle,
} from 'sentry/components/events/interfaces/frame/utils';
import type {Event, Frame} from 'sentry/types/event';

describe('hasFileExtension', () => {
  test('returns true for valid file names with extensions', () => {
    expect(hasFileExtension('example.tsx')).toBe(true);
    expect(hasFileExtension('document.py')).toBe(true);
    expect(hasFileExtension('photo.jpeg')).toBe(true);
    expect(hasFileExtension('archive.tar.gz')).toBe(true); // Testing for multi-part extensions
  });

  test('returns false for file names without extensions', () => {
    expect(hasFileExtension('example')).toBe(false);
    expect(hasFileExtension('<anonymous>')).toBe(false);
    expect(hasFileExtension('example.')).toBe(false);
    expect(hasFileExtension('https://sentry.sentry.io/issues/')).toBe(false);
  });

  test('handles edge cases and special characters correctly', () => {
    expect(hasFileExtension('.htaccess')).toBe(true); // Starting with a dot
    expect(hasFileExtension('example.TXT')).toBe(true); // Uppercase extension
    expect(hasFileExtension('example.tar.gz')).toBe(true); // Multi-part extension
    expect(hasFileExtension('')).toBe(false); // Empty string
    expect(hasFileExtension('example@.py')).toBe(true); // Special characters
  });
});

describe('shouldDisplayAbsPathInTitle', () => {
  it('returns false when absPath is from event subdomain', () => {
    const event = {
      tags: [{key: 'url', value: 'https://example.com/page'}],
      platform: 'javascript',
    } as Event;
    const frame = {
      absPath: 'https://cdn.example.org/script.js',
    } as Frame;
    expect(shouldDisplayAbsPathInTitle(frame, event)).toBe(true);
  });

  it('returns false when absPath is from same origin as event', () => {
    const event = {
      tags: [{key: 'url', value: 'https://example.com/page'}],
      platform: 'javascript',
    } as Event;
    const frame = {
      absPath: 'https://example.com/script.js',
    } as Frame;
    expect(shouldDisplayAbsPathInTitle(frame, event)).toBe(false);
  });

  it('returns false when absPath is not a URL', () => {
    const event = {
      tags: [{key: 'url', value: 'https://example.com/page'}],
      platform: 'javascript',
    } as Event;
    const frame = {
      absPath: '/path/to/script.js',
    } as Frame;
    expect(shouldDisplayAbsPathInTitle(frame, event)).toBe(false);
  });

  it('returns false when event has no origin', () => {
    const event = {
      tags: [{key: 'something', value: 'else'}],
      platform: 'javascript',
    } as Event;
    const frame = {
      absPath: 'https://cdn.example.org/script.js',
    } as Frame;
    expect(shouldDisplayAbsPathInTitle(frame, event)).toBe(false);
  });

  it('returns true when script is from a different origin', () => {
    const event = {
      tags: [{key: 'url', value: 'https://example.com/page'}],
      platform: 'javascript',
    } as Event;
    const frame = {
      absPath: 'https://muy-diferente.com/script.js',
    } as Frame;
    expect(shouldDisplayAbsPathInTitle(frame, event)).toBe(true);
  });

  it('returns false when platform is not js', () => {
    const event = {
      tags: [{key: 'url', value: 'https://example.com/page'}],
      platform: 'python',
    } as Event;
    const frame = {
      absPath: 'https://muy-diferente.com/script.js',
    } as Frame;
    expect(shouldDisplayAbsPathInTitle(frame, event)).toBe(false);
  });

  it('returns false when event URL is an IP address', () => {
    const event = {
      tags: [{key: 'url', value: 'http://192.168.1.1/page'}],
      platform: 'javascript',
    } as Event;
    const frame = {
      absPath: 'https://192.168.1.1/script.js',
    } as Frame;
    expect(shouldDisplayAbsPathInTitle(frame, event)).toBe(false);
  });

  it('returns false when event URL is localhost', () => {
    const event = {
      tags: [{key: 'url', value: 'http://localhost:8000/page'}],
      platform: 'javascript',
    } as Event;
    const frame = {
      absPath: 'http://localhost:8000/script.js',
    } as Frame;
    expect(shouldDisplayAbsPathInTitle(frame, event)).toBe(false);
  });

  it('returns true when script is from different IP than event', () => {
    const event = {
      tags: [{key: 'url', value: 'http://192.168.1.1/page'}],
      platform: 'javascript',
    } as Event;
    const frame = {
      absPath: 'https://192.168.1.2/script.js',
    } as Frame;
    expect(shouldDisplayAbsPathInTitle(frame, event)).toBe(true);
  });
});
