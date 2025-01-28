import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import GroupTagDistributionMeter from 'sentry/components/group/tagDistributionMeter';

describe('TagDistributionMeter', function () {
  const organization = OrganizationFixture();
  const tags = TagsFixture();

  it('should return "no recent data" if no total values present', function () {
    render(
      <GroupTagDistributionMeter
        tag="browser"
        name="Browser"
        topValues={[]}
        onTagClick={jest.fn()}
        group={GroupFixture({id: '1337'})}
        organization={organization}
        projectId="456"
        totalValues={0}
      />
    );
    expect(screen.getByText('No recent data.')).toBeInTheDocument();
  });

  it('should call renderSegments() if values present', function () {
    render(
      <GroupTagDistributionMeter
        tag="browser"
        name="Browser"
        onTagClick={jest.fn()}
        group={GroupFixture({id: '1337'})}
        organization={organization}
        projectId="456"
        totalValues={tags[0]!.totalValues}
        topValues={tags[0]!.topValues}
      />
    );
    expect(
      screen.getByLabelText('Add the browser Chrome segment tag to the search query')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Add the browser Firefox segment tag to the search query')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Other')).toBeInTheDocument();
  });
});
