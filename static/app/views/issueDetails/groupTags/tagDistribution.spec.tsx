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

  it('never displays 100% when there are multiple items', () => {
    // 997/1000 = 99.7% which would round to 100%, but should be capped at 99%
    render(<TagDistribution tag={TagFixture([997, 2, 1], 1000)} />);

    expect(screen.getByText('Chrome0')).toBeInTheDocument();
    expect(screen.getByText('>99%')).toBeInTheDocument(); // Should be >99%, not 100%
    expect(screen.queryByText('100%')).not.toBeInTheDocument(); // Should never show 100%
    expect(screen.getByText('Chrome1')).toBeInTheDocument();
    expect(screen.getAllByText('<1%')).toHaveLength(2); // Chrome1 and Chrome2 both show <1%
    expect(screen.getByText('Chrome2')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument(); // No other items
  });

  it('other section never displays 100% when there are visible items', () => {
    // Create a case where visible items have very small percentages that round to 0%
    // 1 + 1 + 1 = 3 visible (each 0.1% rounds to 0%), 997 other would be 100% but should show >99%
    render(<TagDistribution tag={TagFixture([1, 1, 1], 1000)} />);

    expect(screen.getByText('Chrome0')).toBeInTheDocument();
    expect(screen.getAllByText('<1%')).toHaveLength(3); // Chrome0, Chrome1, Chrome2 all show <1%
    expect(screen.getByText('Chrome1')).toBeInTheDocument();
    expect(screen.getByText('Chrome2')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText('>99%')).toBeInTheDocument(); // Other should show >99%, not 100%
    expect(screen.queryByText('100%')).not.toBeInTheDocument(); // Should never show 100%
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
