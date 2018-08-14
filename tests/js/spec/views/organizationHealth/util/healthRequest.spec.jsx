import {mount} from 'enzyme';
import React from 'react';

import {doHealthRequest} from 'app/actionCreators/health';
import {HealthRequestWithParams} from 'app/views/organizationHealth/util/healthRequest';

jest.mock('app/actionCreators/health', () => {
  return {
    doHealthRequest: jest.fn(() =>
      Promise.resolve({
        data: [[new Date(), [{count: 123, release: {slug: 'release-slug'}}]]],
      })
    ),
  };
});

describe('HealthRequest', function() {
  const project = TestStubs.Project();
  const organization = TestStubs.Organization();
  const mock = jest.fn(() => null);
  let wrapper;

  describe('with props changes', function() {
    beforeAll(function() {
      doHealthRequest.mockImplementation(() =>
        Promise.resolve({
          data: [[new Date(), [{count: 123, release: 'release-name'}]]],
        })
      );
      wrapper = mount(
        <HealthRequestWithParams
          api={{}}
          projects={[project.id]}
          environments={[]}
          period="24h"
          organization={organization}
          tag="release"
        >
          {mock}
        </HealthRequestWithParams>
      );
    });

    it('makes requests', async function() {
      expect(mock).toHaveBeenCalledWith({loading: true, data: null, originalData: null});

      expect(mock).toHaveBeenLastCalledWith({
        loading: false,
        data: [
          {
            seriesName: 'release-name',
            data: [
              expect.objectContaining({
                name: expect.anything(),
                value: 123,
              }),
            ],
          },
        ],
        originalData: [[expect.anything(), expect.anything()]],
      });

      expect(doHealthRequest).toHaveBeenCalled();
    });

    it('makes a new request if projects prop changes', async function() {
      doHealthRequest.mockClear();

      wrapper.setProps({projects: ['123']});
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
      expect(doHealthRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          period: '7d',
        })
      );
    });

    it('makes a new request if timeseries prop changes', async function() {
      doHealthRequest.mockClear();

      wrapper.setProps({timeseries: false});
      expect(doHealthRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          timeseries: false,
        })
      );
    });
  });

  it('defines a category name getter', async function() {
    doHealthRequest.mockImplementation(() =>
      Promise.resolve({
        data: [[new Date(), [{count: 123, release: {slug: 'release-slug'}}]]],
      })
    );
    wrapper = mount(
      <HealthRequestWithParams
        api={{}}
        projects={[project.id]}
        environments={[]}
        period="24h"
        organization={organization}
        tag="release"
        getCategory={release => release && release.slug}
      >
        {mock}
      </HealthRequestWithParams>
    );
    await tick();
    wrapper.update();
    expect(mock).toHaveBeenLastCalledWith({
      loading: false,
      data: [
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
      originalData: [[expect.anything(), expect.anything()]],
    });
  });

  it('transforms data for non-timeseries response', async function() {
    doHealthRequest.mockImplementation(() =>
      Promise.resolve({
        data: [{count: 123, release: 'release-name'}],
      })
    );
    wrapper = mount(
      <HealthRequestWithParams
        api={{}}
        projects={[project.id]}
        environments={[]}
        period="24h"
        organization={organization}
        tag="release"
        timeseries={false}
      >
        {mock}
      </HealthRequestWithParams>
    );
    await tick();
    wrapper.update();
    expect(mock).toHaveBeenLastCalledWith({
      loading: false,
      data: [['release-name', 123]],
      originalData: [{count: 123, release: 'release-name'}],
    });
  });
});
