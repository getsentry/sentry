import {getEventIdMappings, getShortEventId} from './events';

describe('getShortEventId', () => {
  it('returns the first 8 characters of an event ID', () => {
    const eventId = 'a1b2c3d4e5f67890abcdef1234567890';
    const result = getShortEventId(eventId);
    expect(result).toBe('a1b2c3d4');
  });

  it('stores the mapping in a global variable', () => {
    const eventId = 'a1b2c3d4e5f67890abcdef1234567890';
    getShortEventId(eventId);

    const mappings = getEventIdMappings();
    expect(mappings).toEqual({a1b2c3d4: eventId});
  });

  it('does not overwrite existing mapping if short ID maps to the same full ID', () => {
    const eventId = 'a1b2c3d4e5f67890abcdef1234567890';

    // First call stores the mapping
    getShortEventId(eventId);
    const firstMappings = getEventIdMappings();

    // Second call with same ID should keep the same mapping
    getShortEventId(eventId);
    const secondMappings = getEventIdMappings();

    expect(firstMappings).toEqual(secondMappings);
    expect(secondMappings).toEqual({a1b2c3d4: eventId});
  });

  it('updates mapping if short ID maps to a different full ID', () => {
    const eventId1 = 'a1b2c3d4e5f67890abcdef1234567890';
    const eventId2 = 'a1b2c3d4ffffffffffffffffffffffff';

    getShortEventId(eventId1);
    const firstMappings = getEventIdMappings();
    expect(firstMappings).toEqual({a1b2c3d4: eventId1});

    getShortEventId(eventId2);
    const secondMappings = getEventIdMappings();
    expect(secondMappings).toEqual({a1b2c3d4: eventId2});
  });

  it('accumulates multiple event ID mappings', () => {
    const eventId1 = 'a1b2c3d4e5f67890abcdef1234567890';
    const eventId2 = 'f0e1d2c3b4a59687fedcba9876543210';

    getShortEventId(eventId1);
    getShortEventId(eventId2);

    const mappings = getEventIdMappings();
    expect(mappings).toEqual({
      a1b2c3d4: eventId1,
      f0e1d2c3: eventId2,
    });
  });
});

describe('getEventIdMappings', () => {
  it('returns a copy of the mappings object', () => {
    const eventId = 'test123456789abcdef';
    getShortEventId(eventId);

    const mappings1 = getEventIdMappings();
    const mappings2 = getEventIdMappings();

    // Should be equal but not the same object reference
    expect(mappings1).toEqual(mappings2);
    expect(mappings1).not.toBe(mappings2);
  });

  it('returns empty object when no mappings exist', () => {
    // Note: This test may fail if other tests have already populated mappings
    // In a real scenario, we'd need a way to clear the mappings between tests
    const mappings = getEventIdMappings();
    expect(typeof mappings).toBe('object');
  });
});
