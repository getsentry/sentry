import React from 'react';
import {mount} from 'sentry-test/enzyme';

import {initializeOrg} from 'sentry-test/initializeOrg';
import ReleaseSeries from 'app/components/charts/releaseSeries';

describe('ReleaseSeries', function() {
  const renderFunc = jest.fn(() => null);
  const {routerContext, organization} = initializeOrg();
  const releases = [TestStubs.Release()];
  let releasesMock;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    releasesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: releases,
    });
  });

  it('does not fetch releases if releases is truthy', function() {
    mount(
      <ReleaseSeries organization={organization} releases={[]}>
        {renderFunc}
      </ReleaseSeries>,
      routerContext
    );

    expect(releasesMock).not.toHaveBeenCalled();
  });

  it('fetches releases if no releases passed through props', async function() {
    const wrapper = mount(<ReleaseSeries>{renderFunc}</ReleaseSeries>, routerContext);

    await tick();
    wrapper.update();

    expect(releasesMock).toHaveBeenCalled();

    expect(renderFunc).toHaveBeenCalledWith(
      expect.objectContaining({
        releases,
      })
    );
  });

  it('fetches releases with project conditions', async function() {
    const wrapper = mount(
      <ReleaseSeries projects={[1, 2]}>{renderFunc}</ReleaseSeries>,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(releasesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {project: [1, 2]},
      })
    );
  });

  it('generates an eCharts `markLine` series from releases', async function() {
    const wrapper = mount(<ReleaseSeries>{renderFunc}</ReleaseSeries>, routerContext);

    await tick();
    wrapper.update();

    expect(renderFunc).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseSeries: [
          expect.objectContaining({
            // we don't care about the other properties for now
            markLine: expect.objectContaining({
              data: [
                expect.objectContaining({
                  name: '92eccef',
                  value: '92eccef',
                  xAxis: 1530206345000,
                }),
              ],
            }),
          }),
        ],
      })
    );
  });
});
