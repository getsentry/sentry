import {ThemeProvider} from '@emotion/react';

import {Container} from '@sentry/scraps/layout';

import {PriorityLevel} from 'sentry/types/group';
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {StreamGroupRow} from './streamGroupRow';

const themes = {light: lightTheme, dark: darkTheme};

function IssueListContainer({children}: {children: React.ReactNode}) {
  return (
    <Container containerType="inline-size" width="1200px" padding="sm">
      {children}
    </Container>
  );
}

const fakeSummary = (
  <div>
    <div style={{fontWeight: 600, marginBottom: 2}}>RequestError: GET /issues/ 404</div>
    <div style={{fontSize: 12, color: '#80708f'}}>
      JAVASCRIPT-6QS | fetchData(app/components/group/suggestedOwners)
    </div>
  </div>
);

const fakeChart = (
  <div
    style={{width: 175, height: 36, background: '#e8e1f0', borderRadius: 4}}
    data-testid="chart"
  />
);

describe('StreamGroupRow', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot(
      'default',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <IssueListContainer>
            <StreamGroupRow
              summary={fakeSummary}
              chart={fakeChart}
              eventCount={<span>327k</span>}
              userCount={<span>35k</span>}
              priority={<span>{PriorityLevel.MEDIUM}</span>}
              assignee={<span>JD</span>}
            />
          </IssueListContainer>
        </ThemeProvider>
      ),
      {viewport: 1400}
    );

    it.snapshot(
      'with-checkbox',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <IssueListContainer>
            <StreamGroupRow
              summary={fakeSummary}
              checkbox={
                <div style={{width: 32, display: 'flex', justifyContent: 'center'}}>
                  <input type="checkbox" />
                </div>
              }
              chart={fakeChart}
              eventCount={<span>327k</span>}
              userCount={<span>35k</span>}
              priority={<span>{PriorityLevel.HIGH}</span>}
              assignee={<span>JD</span>}
            />
          </IssueListContainer>
        </ThemeProvider>
      ),
      {viewport: 1400}
    );

    it.snapshot(
      'reviewed',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <IssueListContainer>
            <StreamGroupRow
              summary={fakeSummary}
              chart={fakeChart}
              eventCount={<span>42</span>}
              userCount={<span>8</span>}
              reviewed
            />
          </IssueListContainer>
        </ThemeProvider>
      ),
      {viewport: 1400}
    );

    it.snapshot(
      'no-chart',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <IssueListContainer>
            <StreamGroupRow
              summary={fakeSummary}
              showChart={false}
              eventCount={<span>327k</span>}
              userCount={<span>35k</span>}
              priority={<span>{PriorityLevel.MEDIUM}</span>}
              assignee={<span>JD</span>}
            />
          </IssueListContainer>
        </ThemeProvider>
      ),
      {viewport: 1400}
    );

    it.snapshot(
      'stats-disabled',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <IssueListContainer>
            <StreamGroupRow
              summary={fakeSummary}
              statsEnabled={false}
              priority={<span>{PriorityLevel.LOW}</span>}
              assignee={<span>Unassigned</span>}
            />
          </IssueListContainer>
        </ThemeProvider>
      ),
      {viewport: 1400}
    );

    it.snapshot(
      'with-progress',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <IssueListContainer>
            <StreamGroupRow
              summary={fakeSummary}
              chart={fakeChart}
              eventCount={<span>100</span>}
              userCount={<span>12</span>}
              priority={<span>{PriorityLevel.HIGH}</span>}
              progress={<span>Fix Proposed</span>}
              assignee={<span>JD</span>}
              withColumns={[
                'graph',
                'event',
                'users',
                'priority',
                'progress',
                'assignee',
              ]}
            />
          </IssueListContainer>
        </ThemeProvider>
      ),
      {viewport: 1400}
    );

    it.snapshot(
      'with-first-last-seen',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <IssueListContainer>
            <StreamGroupRow
              summary={fakeSummary}
              chart={fakeChart}
              eventCount={<span>500</span>}
              userCount={<span>50</span>}
              firstSeen={<span>2y</span>}
              lastSeen={<span>3h ago</span>}
              priority={<span>{PriorityLevel.MEDIUM}</span>}
              assignee={<span>JD</span>}
              withColumns={[
                'graph',
                'firstSeen',
                'lastSeen',
                'event',
                'users',
                'priority',
                'assignee',
              ]}
            />
          </IssueListContainer>
        </ThemeProvider>
      ),
      {viewport: 1400}
    );

    it.snapshot(
      'loading-placeholders',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <IssueListContainer>
            <StreamGroupRow
              summary={
                <div style={{height: 58, background: '#f0f0f0', borderRadius: 4}} />
              }
            />
          </IssueListContainer>
        </ThemeProvider>
      ),
      {viewport: 1400}
    );
  });
});
