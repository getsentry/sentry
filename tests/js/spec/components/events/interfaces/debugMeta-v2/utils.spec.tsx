import {
  combineStatus,
  getFileName,
  getStatusWeight,
} from 'app/components/events/interfaces/debugMeta-v2/utils';
import {ImageProcessingInfo} from 'app/types/debugImage';

describe('DebugMeta  - utils', () => {
  describe('getStatusWeight function', () => {
    const data = [
      {
        parameter: ImageProcessingInfo.FOUND,
        result: 1,
      },
      {
        parameter: ImageProcessingInfo.UNUSED,
        result: 0,
      },
      {
        parameter: null,
        result: 0,
      },
      {
        parameter: ImageProcessingInfo.MISSING,
        result: 2,
      },
      {
        parameter: ImageProcessingInfo.MALFORMED,
        result: 2,
      },
      {
        parameter: ImageProcessingInfo.FETCHING_FAILED,
        result: 2,
      },
      {
        parameter: ImageProcessingInfo.TIMEOUT,
        result: 2,
      },
      {
        parameter: ImageProcessingInfo.OTHER,
        result: 2,
      },
    ];

    it('should return a number according to the passed parameter', () => {
      for (const {parameter, result} of data) {
        const statusWeight = getStatusWeight(parameter);
        expect(statusWeight).toEqual(result);
      }
    });
  });

  describe('getFileName function', () => {
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

    it('should return the file name of a provided filepath', () => {
      for (const {directory, fileName} of filePaths) {
        const result = getFileName(`${directory}${fileName}`);
        expect(result).toEqual(fileName);
      }
    });
  });

  describe('combineStatus function', () => {
    const status = [
      {
        debugStatus: ImageProcessingInfo.MISSING,
        unwindStatus: ImageProcessingInfo.UNUSED,
        combinedStatus: ImageProcessingInfo.MISSING,
      },
      {
        debugStatus: ImageProcessingInfo.FOUND,
        unwindStatus: ImageProcessingInfo.MISSING,
        combinedStatus: ImageProcessingInfo.MISSING,
      },
      {
        debugStatus: ImageProcessingInfo.FOUND,
        unwindStatus: ImageProcessingInfo.UNUSED,
        combinedStatus: ImageProcessingInfo.FOUND,
      },
      {
        debugStatus: ImageProcessingInfo.FOUND,
        unwindStatus: null,
        combinedStatus: ImageProcessingInfo.FOUND,
      },
      {
        debugStatus: undefined,
        unwindStatus: undefined,
        combinedStatus: ImageProcessingInfo.UNUSED,
      },
      {
        debugStatus: undefined,
        unwindStatus: null,
        combinedStatus: ImageProcessingInfo.UNUSED,
      },
      {
        debugStatus: null,
        unwindStatus: null,
        combinedStatus: ImageProcessingInfo.UNUSED,
      },
    ];

    it('should return the status according to the passed parameters', () => {
      for (const {debugStatus, unwindStatus, combinedStatus} of status) {
        const result = combineStatus(debugStatus, unwindStatus);
        expect(result).toEqual(combinedStatus);
      }
    });
  });
});
