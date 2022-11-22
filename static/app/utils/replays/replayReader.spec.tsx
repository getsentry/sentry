import moment from 'moment';

import ReplayReader from './replayReader';

describe('ReplayReader', () => {
  it('should return null if some params are undefined', () => {
    const params = TestStubs.ReplayReaderParams();

    for (const field in Object.keys(params)) {
      const factoryArgs = {
        ...params,
        [field]: undefined,
      };
      expect(ReplayReader.factory(factoryArgs)).toBeNull();
    }
  });

  it('should hydrate startedAt, finishedAt and duration fields', () => {
    const mockReplay = ReplayReader.factory(
      TestStubs.ReplayReaderParams()
    ) as ReplayReader;

    expect(mockReplay.getReplay().startedAt).toBeInstanceOf(Date);
    expect(mockReplay.getReplay().finishedAt).toBeInstanceOf(Date);
    expect(moment.isDuration(mockReplay.getReplay().duration)).toBeTruthy();
  });
});
