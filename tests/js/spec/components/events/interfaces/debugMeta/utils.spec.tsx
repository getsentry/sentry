import {
  combineStatus,
  getFileName,
  getStatusWeight,
} from 'sentry/components/events/interfaces/debugMeta/utils';
import {ImageStatus} from 'sentry/types/debugImage';

describe('DebugMeta  - utils', function () {
  describe('getStatusWeight function', function () {
    const data = [
      {
        parameter: ImageStatus.FOUND,
        result: 1,
      },
      {
        parameter: ImageStatus.UNUSED,
        result: 0,
      },
      {
        parameter: null,
        result: 0,
      },
      {
        parameter: ImageStatus.MISSING,
        result: 2,
      },
      {
        parameter: ImageStatus.MALFORMED,
        result: 2,
      },
      {
        parameter: ImageStatus.FETCHING_FAILED,
        result: 2,
      },
      {
        parameter: ImageStatus.TIMEOUT,
        result: 2,
      },
      {
        parameter: ImageStatus.OTHER,
        result: 2,
      },
    ];

    it('should return a number according to the passed parameter', function () {
      for (const {parameter, result} of data) {
        const statusWeight = getStatusWeight(parameter);
        expect(statusWeight).toEqual(result);
      }
    });
  });

  describe('getFileName function', function () {
    const filePaths = [
      {
        fileName: 'libsystem_kernel.dylib',
        directory: '/usr/lib/system/',
      },
      {
        fileName: 'libsentry.dylib',
        directory: '/Users/user/Coding/sentry-native/build/',
      },
    ];

    it('should return the file name of a provided filepath', function () {
      for (const {directory, fileName} of filePaths) {
        const result = getFileName(`${directory}${fileName}`);
        expect(result).toEqual(fileName);
      }
    });
  });

  describe('combineStatus function', function () {
    const status = [
      {
        debugStatus: ImageStatus.MISSING,
        unwindStatus: ImageStatus.UNUSED,
        combinedStatus: ImageStatus.MISSING,
      },
      {
        debugStatus: ImageStatus.FOUND,
        unwindStatus: ImageStatus.MISSING,
        combinedStatus: ImageStatus.MISSING,
      },
      {
        debugStatus: ImageStatus.FOUND,
        unwindStatus: ImageStatus.UNUSED,
        combinedStatus: ImageStatus.FOUND,
      },
      {
        debugStatus: ImageStatus.FOUND,
        unwindStatus: null,
        combinedStatus: ImageStatus.FOUND,
      },
      {
        debugStatus: undefined,
        unwindStatus: undefined,
        combinedStatus: ImageStatus.UNUSED,
      },
      {
        debugStatus: undefined,
        unwindStatus: null,
        combinedStatus: ImageStatus.UNUSED,
      },
      {
        debugStatus: null,
        unwindStatus: null,
        combinedStatus: ImageStatus.UNUSED,
      },
    ];

    it('should return the status according to the passed parameters', function () {
      for (const {debugStatus, unwindStatus, combinedStatus} of status) {
        const result = combineStatus(debugStatus, unwindStatus);
        expect(result).toEqual(combinedStatus);
      }
    });
  });
});
