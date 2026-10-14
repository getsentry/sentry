import {getKnownData} from 'sentry/components/events/contexts/utils';

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
});
