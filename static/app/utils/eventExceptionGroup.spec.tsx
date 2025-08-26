import {EventEntryExceptionGroupFixture} from 'sentry-fixture/eventEntryChainedException';
import {ExceptionValueFixture} from 'sentry-fixture/exceptionValue';

import {EntryType} from 'sentry/types/event';
import {
  buildExceptionGroupTree,
  getExceptionGroupHeight,
  getExceptionGroupWidth,
} from 'sentry/utils/eventExceptionGroup';

describe('eventExceptionGroup', () => {
  describe('buildExceptionGroupTree', () => {
    it('builds the exception group tree', () => {
      const exception = EventEntryExceptionGroupFixture();

      expect(buildExceptionGroupTree(exception)).toEqual([
        {
          value: expect.objectContaining({
            type: 'ExceptionGroup 1',
          }),
          children: [
            {
              value: expect.objectContaining({
                type: 'ExceptionGroup 2',
              }),
              children: [
                {
                  value: expect.objectContaining({
                    type: 'ValueError',
                  }),
                  children: [],
                },
              ],
            },
            {
              value: expect.objectContaining({
                type: 'TypeError',
              }),
              children: [],
            },
          ],
        },
      ]);
    });
  });

  describe('getExceptionGroupHeight', () => {
    it('gets the height of the exception group', () => {
      const exception = EventEntryExceptionGroupFixture();
      expect(getExceptionGroupHeight(exception)).toBe(3);
    });

    it('returns 0 with no values', () => {
      expect(
        getExceptionGroupHeight({
          type: EntryType.EXCEPTION,
          data: {
            excOmitted: null,
            hasSystemFrames: false,
            values: [],
          },
        })
      ).toBe(0);
    });

    it('returns 1 with single parent', () => {
      expect(
        getExceptionGroupHeight({
          type: EntryType.EXCEPTION,
          data: {
            excOmitted: null,
            hasSystemFrames: false,
            values: [
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  exception_id: 1,
                  is_exception_group: true,
                  type: 'ExceptionGroup 1',
                },
              }),
            ],
          },
        })
      ).toBe(1);
    });

    it('returns 2 with a parent and a child', () => {
      expect(
        getExceptionGroupHeight({
          type: EntryType.EXCEPTION,
          data: {
            excOmitted: null,
            hasSystemFrames: false,
            values: [
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 2',
                  is_exception_group: false,
                  exception_id: 2,
                  parent_id: 1,
                },
              }),
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 1',
                  is_exception_group: true,
                  exception_id: 1,
                },
              }),
            ],
          },
        })
      ).toBe(2);
    });

    it('returns 2 with a parent and 2 children', () => {
      expect(
        getExceptionGroupHeight({
          type: EntryType.EXCEPTION,
          data: {
            excOmitted: null,
            hasSystemFrames: false,
            values: [
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 2',
                  is_exception_group: false,
                  exception_id: 2,
                  parent_id: 1,
                },
              }),
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 3',
                  is_exception_group: false,
                  exception_id: 3,
                  parent_id: 1,
                },
              }),
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 1',
                  is_exception_group: true,
                  exception_id: 1,
                },
              }),
            ],
          },
        })
      ).toBe(2);
    });
  });

  describe('getExceptionGroupWidth', () => {
    it('returns 0 with no values', () => {
      expect(
        getExceptionGroupWidth({
          type: EntryType.EXCEPTION,
          data: {
            excOmitted: null,
            hasSystemFrames: false,
            values: [],
          },
        })
      ).toBe(0);
    });

    it('returns 1 with a single parent', () => {
      expect(
        getExceptionGroupWidth({
          type: EntryType.EXCEPTION,
          data: {
            excOmitted: null,
            hasSystemFrames: false,
            values: [
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 1',
                  is_exception_group: true,
                  exception_id: 1,
                },
              }),
            ],
          },
        })
      ).toBe(1);
    });

    it('returns 1 with a parent and a child', () => {
      expect(
        getExceptionGroupWidth({
          type: EntryType.EXCEPTION,
          data: {
            excOmitted: null,
            hasSystemFrames: false,
            values: [
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 2',
                  is_exception_group: false,
                  exception_id: 2,
                  parent_id: 1,
                },
              }),
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 1',
                  is_exception_group: true,
                  exception_id: 1,
                },
              }),
            ],
          },
        })
      ).toBe(1);
    });

    it('returns 2 with a parent and 2 children', () => {
      expect(
        getExceptionGroupWidth({
          type: EntryType.EXCEPTION,
          data: {
            excOmitted: null,
            hasSystemFrames: false,
            values: [
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 2',
                  is_exception_group: false,
                  exception_id: 2,
                  parent_id: 1,
                },
              }),
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 3',
                  is_exception_group: false,
                  exception_id: 3,
                  parent_id: 1,
                },
              }),
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 1',
                  is_exception_group: true,
                  exception_id: 1,
                },
              }),
            ],
          },
        })
      ).toBe(2);
    });

    it('returns 3 with a parent 3 grandchildren', () => {
      expect(
        getExceptionGroupWidth({
          type: EntryType.EXCEPTION,
          data: {
            excOmitted: null,
            hasSystemFrames: false,
            values: [
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 4',
                  is_exception_group: false,
                  exception_id: 4,
                  parent_id: 2,
                },
              }),
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 5',
                  is_exception_group: false,
                  exception_id: 5,
                  parent_id: 2,
                },
              }),
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 6',
                  is_exception_group: false,
                  exception_id: 6,
                  parent_id: 3,
                },
              }),
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 2',
                  is_exception_group: false,
                  exception_id: 2,
                  parent_id: 1,
                },
              }),
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 3',
                  is_exception_group: false,
                  exception_id: 3,
                  parent_id: 1,
                },
              }),
              ExceptionValueFixture({
                mechanism: {
                  handled: true,
                  type: 'ExceptionGroup 1',
                  is_exception_group: true,
                  exception_id: 1,
                },
              }),
            ],
          },
        })
      ).toBe(3);
    });
  });
});
