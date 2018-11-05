import {getEarliestRetentionDate, setDateToTime} from 'app/utils/dates';

describe('utils.dates', function() {
  it('gets the earliest retention date (e.g. 90 days ago)', function() {
    expect(getEarliestRetentionDate()).toEqual(
      new Date(+new Date() - 90 * 24 * 60 * 60 * 1000)
    );
  });

  describe('setDateToTime', function() {
    it('can set new time for current date', function() {
      const date = new Date();
      const newDate = setDateToTime(date, '11:11');
      expect(newDate).toEqual(new Date(1508238680000));
    });

    it('can set new time (including seconds) for current date', function() {
      const date = new Date();
      const newDate = setDateToTime(date, '11:11:11');
      expect(newDate).toEqual(new Date(1508238671000));
    });
  });
});
