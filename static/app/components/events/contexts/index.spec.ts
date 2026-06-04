import {EventFixture} from 'sentry-fixture/event';

import {getOrderedContextItems} from 'sentry/components/events/contexts';
import type {Event} from 'sentry/types/event';

describe('getOrderedContextItems', () => {
  it('orders context items correctly', () => {
    const event: Partial<Event> = {
      user: {
        id: '12345',
        email: 'user@example.com',
      },
      contexts: {
        runtime: {name: 'node', type: 'runtime'},
        os: {
          name: 'macOS',
          version: '15.3.2',
          build: '24D81',
          kernel_version: '24.3.0',
          type: 'os',
        },
        browser: {name: 'Chrome', version: '134'},
        response: {type: 'response', data: {testing: 'lalala'}},
        feedback: {rating: 5, comment: 'Great!'},
      },
    };

    const mockEvent = EventFixture(event);

    const items = getOrderedContextItems(mockEvent);

    expect(items).toHaveLength(6);

    const aliasOrder = items.map(item => item.alias);
    expect(aliasOrder[0]).toBe('response');
    expect(aliasOrder[1]).toBe('feedback');
    expect(aliasOrder[2]).toBe('user');
    expect(aliasOrder[3]).toBe('browser');
    expect(aliasOrder[4]).toBe('runtime');
    expect(aliasOrder[5]).toBe('os');
  });

  it('does not fail with missing context items', () => {
    const mockEventOnlyOs = EventFixture({
      contexts: {
        os: {
          os: 'macOS 15.3.2',
          name: 'macOS',
          version: '15.3.2',
          type: 'os',
        },
      },
    });

    const itemsOnlyOs = getOrderedContextItems(mockEventOnlyOs);
    const osIndex = itemsOnlyOs.findIndex(item => item.alias === 'os');
    expect(osIndex).not.toBe(-1);
  });

  it('filters out empty contexts and contexts only with type', () => {
    const mockEvent = EventFixture({
      contexts: {
        runtime: {
          runtime: 'node v20.18.3',
          name: 'node',
          version: 'v20.18.3',
          type: 'runtime',
        },
        empty: {},
        onlyType: {
          type: 'default',
        },
      },
    });

    const items = getOrderedContextItems(mockEvent);

    const emptyIndex = items.findIndex(item => item.alias === 'empty');
    const onlyTypeIndex = items.findIndex(item => item.alias === 'onlyType');

    expect(emptyIndex).toBe(-1);
    expect(onlyTypeIndex).toBe(-1);
  });
});
