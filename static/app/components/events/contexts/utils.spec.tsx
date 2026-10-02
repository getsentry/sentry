import {
  getContextAttributeKey,
  getKnownData,
} from 'sentry/components/events/contexts/utils';

describe('contexts utils', () => {
  describe('getKnownData', () => {
    it('filters out known data and transforms into the right way', () => {
      const data = {
        device_app_hash: '2421fae1ac9237a8131e74883e52b0f7034a143f',
        build_type: 0,
        app_identifier: 'io.sentry.sample.iOS-Swift',
        app_name: '',
        app_version: '7.1.3',
        app_build: '1',
        app_id: '3145EA1A-0EAE-3F8C-969A-13A01394D3EA',
        type: 'app',
      };

      const knownDataTypes = ['device_app_hash', 'build_type', 'app_name'];

      const knownData = getKnownData({
        data,
        knownDataTypes,
        onGetKnownDataDetails: v => {
          if (v.type === 'device_app_hash') {
            return {
              subject: 'Device App Hash',
              value: v.data.device_app_hash,
            };
          }

          if (v.type === 'app_name') {
            return {
              subject: 'App Name',
              value: v.data.app_name,
            };
          }

          if (v.type === 'build_type') {
            return {
              subject: 'Build Type',
              value: v.data.build_type,
            };
          }

          return;
        },
      });

      expect(knownData).toEqual([
        {
          key: 'device_app_hash',
          value: expect.anything(),
          subject: 'Device App Hash',
          meta: undefined,
        },
        {
          key: 'build_type',
          value: expect.anything(),
          subject: 'Build Type',
          meta: undefined,
        },
      ]);
    });

    it('does not format the value when displaying raw', () => {
      const data = {device_app_hash: 'abc'};
      const knownDataTypes = ['device_app_hash'];

      const knownData = getKnownData({
        data,
        knownDataTypes,
        onGetKnownDataDetails: v => {
          if (v.type === 'device_app_hash') {
            return {
              subject: 'Device App Hash',
              value: v.data.device_app_hash,
            };
          }

          return;
        },
      });

      expect(knownData).toEqual([
        {
          key: 'device_app_hash',
          value: 'abc',
          subject: 'Device App Hash',
          meta: undefined,
        },
      ]);
    });
  });

  describe('getContextAttributeKey', () => {
    it('builds the key from the type when the alias differs from it', () => {
      const attributeKey = getContextAttributeKey({
        alias: 'client_os',
        contextKey: 'name',
        type: 'os',
      });

      expect(attributeKey).toBe('os.name');
    });

    it('builds the key from the alias when no type is given', () => {
      const attributeKey = getContextAttributeKey({alias: 'browser', contextKey: 'name'});

      expect(attributeKey).toBe('browser.name');
    });

    it('builds the key from the alias when the type is default', () => {
      const attributeKey = getContextAttributeKey({
        alias: 'checkout',
        contextKey: 'cart_id',
        type: 'default',
      });

      expect(attributeKey).toBe('checkout.cart_id');
    });

    it('returns the registry name when the context spells the key differently', () => {
      const attributeKeys = [
        getContextAttributeKey({alias: 'user', contextKey: 'ip_address', type: 'user'}),
        getContextAttributeKey({alias: 'trace', contextKey: 'trace_id', type: 'trace'}),
        getContextAttributeKey({
          alias: 'trace',
          contextKey: 'parent_span_id',
          type: 'trace',
        }),
      ];

      expect(attributeKeys).toEqual(['user.ip', 'trace', 'trace.parent_span']);
    });

    it('leaves span_id alone because trace.span describes the root span', () => {
      const attributeKey = getContextAttributeKey({
        alias: 'trace',
        contextKey: 'span_id',
        type: 'trace',
      });

      expect(attributeKey).toBe('trace.span_id');
    });
  });
});
