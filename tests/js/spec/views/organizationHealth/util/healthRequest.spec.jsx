import {mount} from 'enzyme';
import React from 'react';

import {doHealthRequest} from 'app/actionCreators/health';
import {HealthRequestWithParams} from 'app/views/organizationHealth/util/healthRequest';

const COUNT_OBJ = {
  count: 123,
  release: {
    _health_id: 'release:release-slug',
    value: {slug: 'release-slug'},
  },
};

jest.mock('app/actionCreators/health', () => {
  return {
    doHealthRequest: jest.fn(),
  };
});

describe('HealthRequest', function() {
  const project = TestStubs.Project();
  const organization = TestStubs.Organization();
  const mock = jest.fn(() => null);
  const DEFAULTS = {
    api: {},
    projects: [project.id],
    environments: [],
    period: '24h',
    organization,
    tag: 'release',
    includePrevious: false,
    includeTimeseries: true,
  };

  let wrapper;

  describe('with props changes', function() {
    beforeAll(function() {
      doHealthRequest.mockImplementation(() =>
        Promise.resolve({
          data: [[new Date(), [COUNT_OBJ]]],
        })
      );
      wrapper = mount(
        <HealthRequestWithParams {...DEFAULTS}>{mock}</HealthRequestWithParams>
      );
    });

    it('makes requests', async function() {
      expect(mock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          loading: true,
        })
      );

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: false,
          timeseriesData: [
            {
              seriesName: expect.anything(),
              data: [
                expect.objectContaining({
                  name: expect.any(Number),
                  value: 123,
                }),
              ],
            },
          ],
          originalTimeseriesData: [[expect.anything(), expect.anything()]],
          tagData: null,
          originalTagData: null,
        })
      );

      expect(doHealthRequest).toHaveBeenCalled();
    });

    it('makes a new request if projects prop changes', async function() {
      doHealthRequest.mockClear();

      wrapper.setProps({projects: ['123']});
      await tick();
      wrapper.update();
      expect(doHealthRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          projects: ['123'],
        })
      );
    });

    it('makes a new request if environments prop changes', async function() {
      doHealthRequest.mockClear();

      wrapper.setProps({environments: ['dev']});
      await tick();
      wrapper.update();
      expect(doHealthRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          environments: ['dev'],
        })
      );
    });

    it('makes a new request if period prop changes', async function() {
      doHealthRequest.mockClear();

      wrapper.setProps({period: '7d'});
      await tick();
      wrapper.update();
      expect(doHealthRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          period: '7d',
        })
      );
    });

    it('makes a new request if includeTimeseries prop changes', async function() {
      doHealthRequest.mockClear();

      wrapper.setProps({includeTimeseries: false, includeTop: true});
      await tick();
      wrapper.update();
      expect(doHealthRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          timeseries: false,
        })
      );
    });
  });

  describe('transforms', function() {
    beforeEach(function() {
      doHealthRequest.mockClear();
    });

    it('defines a category name getter', async function() {
      doHealthRequest.mockImplementation(() =>
        Promise.resolve({
          data: [[new Date(), [COUNT_OBJ]]],
        })
      );
      wrapper = mount(
        <HealthRequestWithParams
          {...DEFAULTS}
          getCategory={release => release && release.slug}
        >
          {mock}
        </HealthRequestWithParams>
      );
      await tick();
      wrapper.update();
      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: false,
          timeseriesData: [
            {
              seriesName: 'release-slug',
              data: [
                expect.objectContaining({
                  name: expect.anything(),
                  value: 123,
                }),
              ],
            },
          ],
          originalTimeseriesData: [[expect.anything(), expect.anything()]],
        })
      );
    });

    it('expands period in query if `includePrevious` and `timeseries`', async function() {
      doHealthRequest.mockImplementation(() =>
        Promise.resolve({
          data: [
            [new Date(), [{...COUNT_OBJ, count: 321}, {...COUNT_OBJ, count: 79}]],
            [new Date(), [COUNT_OBJ]],
          ],
        })
      );
      wrapper = mount(
        <HealthRequestWithParams
          {...DEFAULTS}
          includeTimeseries={true}
          includePrevious={true}
          getCategory={({slug} = {}) => slug}
        >
          {mock}
        </HealthRequestWithParams>
      );

      await tick();
      wrapper.update();

      // actionCreator handles expanding the period when calling the API
      expect(doHealthRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          period: '24h',
        })
      );

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: false,
          allTimeseriesData: [
            [
              expect.anything(),
              [
                expect.objectContaining({count: 321}),
                expect.objectContaining({count: 79}),
              ],
            ],
            [expect.anything(), [expect.objectContaining({count: 123})]],
          ],
          timeseriesData: [
            {
              seriesName: expect.anything(),
              data: [
                expect.objectContaining({
                  name: expect.anything(),
                  value: 123,
                }),
              ],
            },
          ],
          previousTimeseriesData: {
            seriesName: 'Previous Period',
            data: [
              expect.objectContaining({
                name: expect.anything(),
                value: 400,
              }),
            ],
          },

          originalTimeseriesData: [
            [expect.anything(), [expect.objectContaining({count: 123})]],
          ],

          originalPreviousTimeseriesData: [
            [
              expect.anything(),
              [
                expect.objectContaining({count: 321}),
                expect.objectContaining({count: 79}),
              ],
            ],
          ],
        })
      );
    });

    it('transforms data for non-timeseries response', async function() {
      doHealthRequest.mockImplementation(() =>
        Promise.resolve({
          data: [COUNT_OBJ],
        })
      );
      wrapper = mount(
        <HealthRequestWithParams
          {...DEFAULTS}
          includeTimeseries={false}
          includeTop={true}
          getCategory={({slug} = {}) => slug}
        >
          {mock}
        </HealthRequestWithParams>
      );

      await tick();
      wrapper.update();

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: false,
          tagData: [['release-slug', 123]],
          originalTagData: [
            {
              count: 123,
              release: {
                value: {slug: 'release-slug'},
                _health_id: 'release:release-slug',
              },
            },
          ],
        })
      );
    });

    it('transforms data with percentages only when `includPercentages` prop is true', async function() {
      doHealthRequest.mockImplementation(() =>
        Promise.resolve({
          data: [
            {...COUNT_OBJ, count: 100, lastCount: 50},
            {
              count: 80,
              lastCount: 100,
              release: {
                value: {
                  slug: 'new-release',
                },
              },
            },
          ],
          totals: {
            count: 180,
          },
        })
      );

      wrapper = mount(
        <HealthRequestWithParams
          {...DEFAULTS}
          includeTimeseries={false}
          includeTop={true}
          includePercentages={false}
          getCategory={({slug} = {}) => slug}
        >
          {mock}
        </HealthRequestWithParams>
      );

      await tick();
      wrapper.update();

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          tagDataWithPercentages: null,
        })
      );

      wrapper.setProps({includePercentages: true});
      await tick();
      wrapper.update();

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          tagDataWithPercentages: [
            expect.objectContaining({
              count: 100,
              lastCount: 50,
              percentage: 55.56,
            }),
            expect.objectContaining({
              count: 80,
              lastCount: 100,
              percentage: 44.44,
            }),
          ],
        })
      );
    });

    it('aggregates counts per timestamp only when `includeTimeAggregation` prop is true', async function() {
      doHealthRequest.mockImplementation(() =>
        Promise.resolve({
          data: [[new Date(), [COUNT_OBJ, {...COUNT_OBJ, count: 100}]]],
        })
      );

      wrapper = mount(
        <HealthRequestWithParams
          {...DEFAULTS}
          includeTimeseries={true}
          getCategory={({slug} = {}) => slug}
        >
          {mock}
        </HealthRequestWithParams>
      );

      await tick();
      wrapper.update();

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeAggregatedData: null,
        })
      );

      wrapper.setProps({
        includeTimeAggregation: true,
        timeAggregationSeriesName: 'aggregated series',
      });
      await tick();
      wrapper.update();

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeAggregatedData: {
            seriesName: 'aggregated series',
            data: [{name: expect.anything(), value: 223}],
          },
        })
      );
    });

    it('transparently queries for top tags and then queries for timeseries data using only those top tags', async function() {
      doHealthRequest.mockClear();
      doHealthRequest.mockImplementation((api, props) => {
        if (props.timeseries) {
          return Promise.resolve({
            data: [[new Date(), [COUNT_OBJ, {...COUNT_OBJ, count: 100}]]],
          });
        }

        return Promise.resolve({
          data: [{...COUNT_OBJ, count: 100}],
          totals: {
            count: 100,
            lastCount: 50,
          },
        });
      });

      wrapper = mount(
        <HealthRequestWithParams
          {...DEFAULTS}
          includeTop
          includeTimeseries
          includePercentages
          includeTimeAggregation
          includePrevious
          timeAggregationSeriesName="Aggregated"
          getCategory={({slug} = {}) => slug}
        >
          {mock}
        </HealthRequestWithParams>
      );

      await tick();
      wrapper.update();

      expect(doHealthRequest).toHaveBeenCalledTimes(2);
      expect(doHealthRequest).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({
          timeseries: true,
          specifiers: ['release:release-slug'],
        })
      );

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeAggregatedData: {
            seriesName: 'Aggregated',
            data: [{name: expect.anything(), value: 223}],
          },
        })
      );
    });
  });
});
