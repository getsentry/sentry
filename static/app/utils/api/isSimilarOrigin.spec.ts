import {isSimilarOrigin} from 'sentry/utils/api/isSimilarOrigin';

describe('isSimilarOrigin', () => {
  test.each([
    // Same domain
    ['https://sentry.io', 'https://sentry.io', true],
    ['https://example.io', 'https://example.io', true],

    // Not the same
    ['https://example.io', 'https://sentry.io', false],
    ['https://sentry.io', 'https://io.sentry', false],

    // Sibling domains
    ['https://us.sentry.io', 'https://sentry.sentry.io', true],
    ['https://us.sentry.io', 'https://acme.sentry.io', true],
    ['https://us.sentry.io', 'https://eu.sentry.io', true],
    ['https://woof.sentry.io', 'https://woof-org.sentry.io', true],
    ['https://woof.sentry.io/issues/1234/', 'https://woof-org.sentry.io', true],

    // Subdomain
    ['https://sentry.io/api/0/broadcasts/', 'https://woof.sentry.io', true],
    ['https://sentry.io/api/0/users/', 'https://sentry.sentry.io', true],
    ['https://sentry.io/api/0/users/', 'https://io.sentry.io', true],
    // request to subdomain from parent
    ['https://us.sentry.io/api/0/users/', 'https://sentry.io', true],

    // Not siblings
    ['https://sentry.io/api/0/broadcasts/', 'https://sentry.example.io', false],
    ['https://acme.sentry.io', 'https://acme.sent.ryio', false],
    ['https://woof.example.io', 'https://woof.sentry.io', false],
    ['https://woof.sentry.io', 'https://sentry.woof.io', false],
  ])('allows sibling domains %s and %s is %s', (target, origin, expected) => {
    expect(isSimilarOrigin(target, origin)).toBe(expected);
  });
});
