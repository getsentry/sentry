import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

describe('TagDistribution', () => {
  it('renders distribution topValues [500, 490, 10], totalValues 1000', () => {
    render(<TagDistribution tag={TagFixture([500, 490, 10], 1000)} />);

    expect(screen.getByText('Chrome0')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Chrome1')).toBeInTheDocument();
    expect(screen.getByText('49%')).toBeInTheDocument();
    expect(screen.getByText('Chrome2')).toBeInTheDocument();
    expect(screen.getByText('1%')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  it('renders distribution topValues [500, 490, 5], totalValues 1000', () => {
    render(<TagDistribution tag={TagFixture([500, 490, 5], 1000)} />);

    expect(screen.getByText('Chrome0')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Chrome1')).toBeInTheDocument();
    expect(screen.getByText('49%')).toBeInTheDocument();
    expect(screen.getByText('Chrome2')).toBeInTheDocument();
    expect(screen.getByText('1%')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText('<1%')).toBeInTheDocument();
  });

  it('renders distribution topValues [500, 490, 3], totalValues 1000', () => {
    render(<TagDistribution tag={TagFixture([500, 490, 3], 1000)} />);

    expect(screen.getByText('Chrome0')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Chrome1')).toBeInTheDocument();
    expect(screen.getByText('49%')).toBeInTheDocument();
    expect(screen.getByText('Chrome2')).toBeInTheDocument();
    expect(screen.getByText('<1%')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText('1%')).toBeInTheDocument();
  });

  it('renders distribution topValues [500, 480, 15], totalValues 1000', () => {
    render(<TagDistribution tag={TagFixture([500, 480, 15], 1000)} />);

    expect(screen.getByText('Chrome0')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Chrome1')).toBeInTheDocument();
    expect(screen.getByText('48%')).toBeInTheDocument();
    expect(screen.getByText('Chrome2')).toBeInTheDocument();
    expect(screen.getByText('2%')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText('<1%')).toBeInTheDocument();
  });
});

function TagFixture(topValues: number[], totalValues: number): GroupTag {
  return {
    topValues: topValues.map((count, index) => ({
      count,
      name: `Chrome${index}`,
      value: `Chrome${index}`,
      lastSeen: '2018-11-16T22:52:24Z',
      key: 'browser',
      firstSeen: '2018-05-06T03:48:28.855Z',
    })),
    name: 'Browser',
    key: 'browser',
    totalValues,
  };
}
