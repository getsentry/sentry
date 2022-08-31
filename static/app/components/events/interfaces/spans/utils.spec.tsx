import {getFormattedTimeRangeWithLeadingZero} from './utils';

describe('test utility functions', function () {
  it('getFormattedTimeRangeWithLeadingZero', function () {
    let result = getFormattedTimeRangeWithLeadingZero(
      1658925888.601534,
      1658925888.60193
    );

    expect(result.start).toEqual('1658925888.601534');
    expect(result.end).toEqual('1658925888.060193');

    result = getFormattedTimeRangeWithLeadingZero(1658925888.601534, 165892588.060193);
    expect(result.start).toEqual('1658925888.601534');
    expect(result.end).toEqual('0165892588.060193');

    result = getFormattedTimeRangeWithLeadingZero(16589258.6015, 1658925888.060193);
    expect(result.start).toEqual('0016589258.006015');
    expect(result.end).toEqual('1658925888.060193');

    result = getFormattedTimeRangeWithLeadingZero(1658925888.601534, 1658925888.601935);
    expect(result.start).toEqual('1658925888.601534');
    expect(result.end).toEqual('1658925888.601935');
  });
});
