import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {GroupIdProvider} from './groupIdContext';
import {IssueDetailsBasePathProvider, useIssueDetailsPath} from './issueDetailsPath';

describe('useIssueDetailsPath', () => {
  const organization = OrganizationFixture();
  const inboxPath = `/organizations/${organization.slug}/inbox/issue/1/`;

  it('defaults to the issue details page', () => {
    const {result} = renderHookWithProviders(useIssueDetailsPath, {
      organization,
      additionalWrapper: ({children}: {children: ReactNode}) => (
        <GroupIdProvider groupId="1">{children}</GroupIdProvider>
      ),
    });

    expect(result.current()).toBe(`/organizations/${organization.slug}/issues/1/`);
    expect(result.current('abc')).toBe(
      `/organizations/${organization.slug}/issues/1/events/abc/`
    );
  });

  it('uses the base path provided by the host page', () => {
    const {result} = renderHookWithProviders(useIssueDetailsPath, {
      organization,
      additionalWrapper: ({children}: {children: ReactNode}) => (
        <IssueDetailsBasePathProvider groupId="1" basePath={inboxPath}>
          <GroupIdProvider groupId="1">{children}</GroupIdProvider>
        </IssueDetailsBasePathProvider>
      ),
    });

    expect(result.current()).toBe(inboxPath);
    expect(result.current('abc')).toBe(`${inboxPath}events/abc/`);
  });

  it('ignores the provided base path for other issues', () => {
    const {result} = renderHookWithProviders(useIssueDetailsPath, {
      organization,
      additionalWrapper: ({children}: {children: ReactNode}) => (
        <IssueDetailsBasePathProvider groupId="1" basePath={inboxPath}>
          <GroupIdProvider groupId="2">{children}</GroupIdProvider>
        </IssueDetailsBasePathProvider>
      ),
    });

    expect(result.current('abc')).toBe(
      `/organizations/${organization.slug}/issues/2/events/abc/`
    );
  });
});
