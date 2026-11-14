import {renderHook} from 'sentry-test/reactTestingLibrary';

import {Tab} from './types';
import {useIssueDrawerReturnPath} from './useIssueDrawerReturnPath';

const baseUrl = '/organizations/org/issues/1/';

describe('useIssueDrawerReturnPath', () => {
  it('returns to the tab that was open before the drawer', () => {
    const {result, rerender} = renderHook(useIssueDrawerReturnPath, {
      initialProps: {baseUrl, currentTab: Tab.AUTOFIX, pathname: `${baseUrl}autofix/`},
    });

    rerender({baseUrl, currentTab: Tab.ACTIVITY, pathname: `${baseUrl}activity/`});

    expect(result.current()).toBe(`${baseUrl}autofix/`);
  });

  it('falls back to the issue when the drawer was opened directly', () => {
    const {result} = renderHook(useIssueDrawerReturnPath, {
      initialProps: {baseUrl, currentTab: Tab.ACTIVITY, pathname: `${baseUrl}activity/`},
    });

    expect(result.current()).toBe(baseUrl);
  });

  it('ignores a tab remembered from another issue', () => {
    const {result, rerender} = renderHook(useIssueDrawerReturnPath, {
      initialProps: {baseUrl, currentTab: Tab.AUTOFIX, pathname: `${baseUrl}autofix/`},
    });
    const otherBaseUrl = '/organizations/org/issues/2/';

    rerender({
      baseUrl: otherBaseUrl,
      currentTab: Tab.ACTIVITY,
      pathname: `${otherBaseUrl}activity/`,
    });

    expect(result.current()).toBe(otherBaseUrl);
  });
});
