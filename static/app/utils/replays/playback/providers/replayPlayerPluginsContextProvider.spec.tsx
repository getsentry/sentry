import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {
  ReplayPlayerPluginsContextProvider,
  useReplayPlayerPlugins,
} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {OrganizationContext} from 'sentry/views/organizationContext';

function makeWrapper(organization: Organization) {
  return function ({children}: {children?: ReactNode}) {
    return (
      <OrganizationContext value={organization}>
        <ReplayPlayerPluginsContextProvider>
          {children}
        </ReplayPlayerPluginsContextProvider>
      </OrganizationContext>
    );
  };
}

describe('replayPlayerPluginsContext', () => {
  it('should have a stable reference to a function that returns a list of plugins', () => {
    const mockOrganization = OrganizationFixture();

    const {result, rerender} = renderHook(useReplayPlayerPlugins, {
      wrapper: makeWrapper(mockOrganization),
    });

    const initialRef = result.current;

    rerender();

    expect(result.current).toEqual(initialRef);
  });

  it('should return no plugins if you dont use the Provider', () => {
    const mockOrganization = OrganizationFixture();
    const mockEvents: any[] = [];

    const {result} = renderHook(useReplayPlayerPlugins, {
      wrapper: ({children}: {children?: ReactNode}) => (
        <OrganizationContext value={mockOrganization}>{children}</OrganizationContext>
      ),
    });

    expect(result.current(mockEvents)).toStrictEqual([]);
  });

  it('should include the canvas plugin', () => {
    const mockOrganizationWithCanvas = OrganizationFixture();
    const mockEvents: any[] = [];

    const {result: withCanvasResult} = renderHook(useReplayPlayerPlugins, {
      wrapper: makeWrapper(mockOrganizationWithCanvas),
    });

    // It'd be nice if `CanvasReplayerPlugin` were a class and we could instead
    // assert that we have an instance of it.
    expect(withCanvasResult.current(mockEvents)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          onBuild: expect.any(Function),
          handler: expect.any(Function),
        }),
      ])
    );
  });
});
