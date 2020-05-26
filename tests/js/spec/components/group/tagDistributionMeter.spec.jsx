import React from 'react';

import {mount} from 'sentry-test/enzyme';

import GroupTagDistributionMeter from 'app/components/group/tagDistributionMeter';

describe('TagDistributionMeter', function() {
  let element;
  let emptyElement;
  let organization;
  const tags = TestStubs.Tags();

  beforeEach(function() {
    organization = TestStubs.Organization();

    element = mount(
      <GroupTagDistributionMeter
        key="element"
        tag="browser"
        group={{id: '1337'}}
        organization={organization}
        projectId="456"
        totalValues={tags[0].totalValues}
        topValues={tags[0].topValues}
      />
    );

    emptyElement = mount(
      <GroupTagDistributionMeter
        key="emptyElement"
        tag="browser"
        group={{id: '1337'}}
        organization={organization}
        projectId="456"
        totalValues={0}
      />
    );
  });

  describe('renderBody()', function() {
    it('should return null if loading', function() {
      element.setState({
        loading: true,
        error: false,
      });
      element.update();
      expect(element.find('Segment')).toHaveLength(0);
    });

    it('should return null if in an error state', function() {
      element.setState({
        error: true,
        loading: false,
      });
      element.update();
      expect(element.find('Segment')).toHaveLength(0);
    });

    it('should return "no recent data" if no total values present', function() {
      emptyElement.setState({
        error: false,
        loading: false,
      });
      emptyElement.update();
      expect(emptyElement.find('p').text()).toEqual('No recent data.');
    });

    it('should call renderSegments() if values present', function() {
      element.setState({loading: false, error: false});
      expect(element.find('Segment').length).toEqual(2);
      expect(element.find('OtherSegment').length).toEqual(1);
    });
  });
});
