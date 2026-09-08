import {
  identityFields,
  mergeIdentities,
  readIdentity,
  resolveSessionName,
} from './sessionName';

const SESSION_ID = 'aaaaaaaabbbbccccddddeeeeeeeeeeee';

describe('identityFields', () => {
  it('asks the datasets that have an any() aggregate, and nothing of the ones that do not', () => {
    expect(identityFields('traces')).toContain('any(user.email)');
    expect(identityFields('traces')).toContain('any(browser.name)');

    // Errors spells geo without the `user.` prefix, and has no aliased column
    // for browser/OS/device.
    expect(identityFields('errors')).toContain('any(geo.country_code)');
    expect(identityFields('errors')).not.toContain('any(user.geo.country_code)');
    expect(identityFields('errors')).not.toContain('any(browser.name)');

    // Neither logs nor tracemetrics defines any(), so asking would 400.
    expect(identityFields('logs')).toEqual([]);
    expect(identityFields('metrics')).toEqual([]);
  });
});

describe('readIdentity', () => {
  it('reads the aggregate columns back out under dataset-independent names', () => {
    expect(
      readIdentity('traces', {
        'any(user.email)': 'lukas@example.com',
        'any(browser.name)': 'Chrome',
        'any(os.name)': 'macOS',
      })
    ).toEqual({
      userEmail: 'lukas@example.com',
      browserName: 'Chrome',
      osName: 'macOS',
    });
  });

  it('treats scrubbed and empty values as absent', () => {
    expect(
      readIdentity('traces', {
        'any(user.email)': '[Filtered]',
        'any(user.ip)': '[ip]',
        'any(user.username)': '   ',
        'any(user.id)': null,
        'any(os.name)': 'iOS',
      })
    ).toEqual({osName: 'iOS'});
  });
});

describe('mergeIdentities', () => {
  it('keeps the first usable value per attribute rather than the first dataset', () => {
    // Spans answered first but only with an id; the email from errors is the
    // better name and has to win its own slot without dragging the rest along.
    const merged = mergeIdentities([
      {userId: '42', browserName: 'Firefox'},
      {userEmail: 'lukas@example.com', userId: '99', release: '1.0.0'},
    ]);

    expect(merged).toEqual({
      userId: '42',
      browserName: 'Firefox',
      userEmail: 'lukas@example.com',
      release: '1.0.0',
    });
  });
});

describe('resolveSessionName', () => {
  it('always produces a handle, even with no telemetry to go on', () => {
    const name = resolveSessionName(SESSION_ID, {});

    expect(name.handle).toBe('aaaaaaaa');
    expect(name.subject).toBe('Anonymous');
    expect(name.subjectKind).toBe('unknown');
    expect(name.user).toBeUndefined();
  });

  it('walks the chain from most to least identifying', () => {
    const full = {
      userEmail: 'lukas@example.com',
      userUsername: 'lukas',
      userId: '42',
      userIp: '10.0.0.1',
    };

    expect(resolveSessionName(SESSION_ID, full).subject).toBe('lukas@example.com');
    expect(resolveSessionName(SESSION_ID, {...full, userEmail: undefined}).subject).toBe(
      'lukas'
    );
    expect(
      resolveSessionName(SESSION_ID, {
        ...full,
        userEmail: undefined,
        userUsername: undefined,
      }).subject
    ).toBe('User 42');
    expect(resolveSessionName(SESSION_ID, {userIp: '10.0.0.1'}).subject).toBe('10.0.0.1');
  });

  it('carries every known user attribute onto the avatar, whichever rung named the session', () => {
    const name = resolveSessionName(SESSION_ID, {
      userId: '42',
      userIp: '10.0.0.1',
    });

    expect(name.subject).toBe('User 42');
    expect(name.user).toEqual({
      email: '',
      id: '42',
      ip_address: '10.0.0.1',
      username: '',
      name: '',
    });
  });

  it('falls back to a place, then to what emitted the telemetry', () => {
    const located = resolveSessionName(SESSION_ID, {
      geoCity: 'Vienna',
      geoCountry: 'AT',
    });
    expect(located.subject).toBe('Vienna, AT');
    expect(located.subjectKind).toBe('location');
    expect(located.user).toBeUndefined();

    // A backend session has no user and no geo; the SDK at least says what kind
    // of session it is.
    const service = resolveSessionName(SESSION_ID, {
      sdkName: 'sentry.python.django',
    });
    expect(service.subject).toBe('python.django');
    expect(service.subjectKind).toBe('sdk');
  });

  it('reads a country on its own as a location', () => {
    expect(resolveSessionName(SESSION_ID, {geoCountry: 'AT'}).subject).toBe('AT');
  });

  it('pairs the OS with a browser or a device, never both', () => {
    expect(
      resolveSessionName(SESSION_ID, {browserName: 'Chrome', osName: 'macOS'}).context
    ).toBe('Chrome · macOS');
    expect(
      resolveSessionName(SESSION_ID, {deviceFamily: 'iPhone', osName: 'iOS'}).context
    ).toBe('iPhone · iOS');
    expect(
      resolveSessionName(SESSION_ID, {
        browserName: 'Safari',
        deviceFamily: 'iPhone',
        osName: 'iOS',
      }).context
    ).toBe('Safari · iOS');
    expect(resolveSessionName(SESSION_ID, {}).context).toBeUndefined();
  });
});
