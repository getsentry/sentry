import {
  InvestigationBlockFixture,
  InvestigationBreachedMetricDetailFixture,
  InvestigationFailedDetailFixture,
  InvestigationRunningDetailFixture,
} from 'sentry/views/investigations/fixtures';

describe.each([
  ['breached metric', InvestigationBreachedMetricDetailFixture],
  ['running', InvestigationRunningDetailFixture],
  ['failed', InvestigationFailedDetailFixture],
])('%s investigation detail fixture', (_name, fixture) => {
  it('derives the block count from overridden blocks', () => {
    const blocks = [InvestigationBlockFixture({id: 'custom-block'})];

    expect(fixture({blocks})).toMatchObject({
      blockCount: 1,
      blocks,
    });
  });
});
