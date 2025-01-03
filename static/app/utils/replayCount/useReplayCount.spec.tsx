import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import useReplayCount from 'sentry/utils/replayCount/useReplayCount';

function wrapper({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
  );
}

describe('useReplayCount', () => {
  const organization = OrganizationFixture();
  const initialProps = {
    bufferLimit: 100,
    dataSource: 'discover',
    fieldName: 'replay_id',
    organization,
    statsPeriod: '90d',
  };
  const getMockRequest = (body: Record<string, number>) =>
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      body,
    });

  describe('getOne & hasOne', () => {
    it('should return undefined to start, then the count after data is loaded', async () => {
      const mockRequest = getMockRequest({
        '1111': 5,
        '2222': 7,
        '3333': 0,
      });

      const {result} = renderHook(useReplayCount, {
        wrapper,
        initialProps,
      });

      expect(result.current.getOne('1111')).toBeUndefined();
      expect(result.current.getOne('2222')).toBeUndefined();
      expect(result.current.getOne('3333')).toBeUndefined();
      expect(result.current.hasOne('1111')).toBeFalsy();
      expect(result.current.hasOne('2222')).toBeFalsy();
      expect(result.current.hasOne('3333')).toBeFalsy();

      await waitFor(() => {
        expect(mockRequest).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/replay-count/`,
          expect.objectContaining({
            query: expect.objectContaining({
              query: 'replay_id:[1111,2222,3333]',
            }),
          })
        );
      });

      expect(result.current.getOne('1111')).toBe(5);
      expect(result.current.getOne('2222')).toBe(7);
      expect(result.current.getOne('3333')).toBe(0);
      expect(result.current.hasOne('1111')).toBeTruthy();
      expect(result.current.hasOne('2222')).toBeTruthy();
      expect(result.current.hasOne('3333')).toBeFalsy();
    });

    it('should return 0 if the data is loaded but does not include a count for a requested id', async () => {
      const mockRequest = getMockRequest({
        '2222': 7,
      });

      const {result} = renderHook(useReplayCount, {
        wrapper,
        initialProps,
      });

      expect(result.current.getOne('1111')).toBeUndefined();
      expect(result.current.getOne('2222')).toBeUndefined();
      expect(result.current.hasOne('1111')).toBeFalsy();
      expect(result.current.hasOne('2222')).toBeFalsy();

      await waitFor(() => {
        expect(mockRequest).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/replay-count/`,
          expect.objectContaining({
            query: expect.objectContaining({
              query: 'replay_id:[1111,2222]',
            }),
          })
        );
      });

      expect(result.current.getOne('1111')).toBe(0);
      expect(result.current.getOne('2222')).toBe(7);
      expect(result.current.hasOne('1111')).toBeFalsy();
      expect(result.current.hasOne('2222')).toBeTruthy();
    });
  });

  describe('getMany & hasMany', () => {
    it('should return undefined to start, then the count after data is loaded', async () => {
      const mockRequest = getMockRequest({
        '1111': 5,
        '2222': 7,
        '3333': 0,
      });

      const {result} = renderHook(useReplayCount, {
        wrapper,
        initialProps,
      });

      expect(result.current.getMany(['1111', '2222', '3333'])).toStrictEqual({});
      expect(result.current.hasMany(['1111', '2222', '3333'])).toStrictEqual({});

      await waitFor(() => {
        expect(mockRequest).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/replay-count/`,
          expect.objectContaining({
            query: expect.objectContaining({
              query: 'replay_id:[1111,2222,3333]',
            }),
          })
        );
      });

      expect(result.current.getMany(['1111', '2222', '3333'])).toStrictEqual({
        '1111': 5,
        '2222': 7,
        '3333': 0,
      });
      expect(result.current.hasMany(['1111', '2222', '3333'])).toStrictEqual({
        '1111': true,
        '2222': true,
        '3333': false,
      });
    });

    it('should return 0 if the data is loaded but does not include a count for a requested id', async () => {
      const mockRequest = getMockRequest({
        '2222': 7,
      });

      const {result} = renderHook(useReplayCount, {
        wrapper,
        initialProps,
      });

      expect(result.current.getMany(['1111', '2222'])).toStrictEqual({});
      expect(result.current.hasMany(['1111', '2222'])).toStrictEqual({});

      await waitFor(() => {
        expect(mockRequest).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/replay-count/`,
          expect.objectContaining({
            query: expect.objectContaining({
              query: 'replay_id:[1111,2222]',
            }),
          })
        );
      });

      expect(result.current.getMany(['1111', '2222'])).toStrictEqual({
        '1111': 0,
        '2222': 7,
      });
      expect(result.current.hasMany(['1111', '2222'])).toStrictEqual({
        '1111': false,
        '2222': true,
      });
    });
  });
});
