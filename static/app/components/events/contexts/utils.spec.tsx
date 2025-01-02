import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
} from 'sentry/components/events/contexts/utils';

describe('contexts utils', function () {
  describe('getUnknownData', function () {
    it('filters out unknown data and transforms into the right way', function () {
      const allData = {
        id: 1,
        email: 'a@a.com',
        username: 'a',
        count: 1000,
        type: 'type',
        title: 'title',
      };
      const knownKeys = ['id', 'email'];

      const unknownData = getUnknownData({allData, knownKeys});

      expect(unknownData).toEqual([
        {key: 'username', value: 'a', subject: 'username', meta: undefined},
        {key: 'count', value: 1000, subject: 'count', meta: undefined},
      ]);
    });
  });

  describe('getKnownData', function () {
    it('filters out known data and transforms into the right way', function () {
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

          return undefined;
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

    it('does not format the value when displaying raw', function () {
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

          return undefined;
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

  describe('getKnownStructuredData', function () {
    it('formats the output from getKnownData into StructuredEventData', function () {
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

          return undefined;
        },
      });
      const errMeta = {
        device_app_hash: {
          '': {
            err: [
              [
                'invalid_data',
                {
                  reason: 'bad device',
                },
              ],
            ],
          },
        },
      };

      const knownStructuredData = getKnownStructuredData(knownData, errMeta);
      expect(knownData[0]!.key).toEqual(knownStructuredData[0]!.key);
      expect(knownData[0]!.subject).toEqual(knownStructuredData[0]!.subject);
      render(<Fragment>{knownStructuredData[0]!.value as React.ReactNode}</Fragment>);
      expect(screen.getByText(`${knownData[0]!.value}`)).toBeInTheDocument();
      expect(screen.getByTestId('annotated-text-error-icon')).toBeInTheDocument();
    });
  });
});
