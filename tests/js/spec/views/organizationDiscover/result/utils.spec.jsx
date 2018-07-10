import {downloadAsCsv} from 'app/views/organizationDiscover/result/utils';

describe('downloadAsCsv()', function() {
  let locationSpy;
  beforeEach(function() {
    locationSpy = jest.spyOn(window.location, 'assign').mockImplementation(_ => _);
  });

  afterEach(function() {
    jest.restoreAllMocks();
  });

  it('handles raw data', function() {
    const result = {
      meta: [{name: 'message'}, {name: 'environment'}],
      data: [
        {message: 'test 1', environment: 'prod'},
        {message: 'test 2', environment: 'test'},
      ],
    };

    downloadAsCsv(result);
    expect(locationSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        encodeURIComponent('message,environment\ntest 1,prod\ntest 2,test')
      )
    );
  });

  it('handles aggregations', function() {
    const result = {
      meta: [{type: 'UInt64', name: 'count'}],
      data: [{count: 3}],
    };
    downloadAsCsv(result);
    expect(locationSpy).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('count\n3'))
    );
  });

  it('quotes unsafe strings', function() {
    const result = {
      meta: [{name: 'message'}],
      data: [{message: '=HYPERLINK(http://some-bad-website)'}],
    };
    downloadAsCsv(result);
    expect(locationSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        encodeURIComponent("message\n'=HYPERLINK(http://some-bad-website)'")
      )
    );
  });
});
