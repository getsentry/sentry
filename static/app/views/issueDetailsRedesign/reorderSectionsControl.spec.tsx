import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {localStorageWrapper} from 'sentry/utils/localStorage';
import {IssueDetailsContextProvider, SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {ReorderSectionsControl} from './reorderSectionsControl';

function renderControl() {
  return render(
    <IssueDetailsContextProvider>
      {/* Registers telemetry sections into the shared context so the control
          reflects what's actually on the page. */}
      <FoldSection sectionKey={SectionKey.TAGS} title="Tags">
        tags
      </FoldSection>
      <FoldSection sectionKey={SectionKey.BREADCRUMBS} title="Breadcrumbs">
        breadcrumbs
      </FoldSection>
      <ReorderSectionsControl />
    </IssueDetailsContextProvider>
  );
}

describe('ReorderSectionsControl', () => {
  beforeEach(() => {
    localStorageWrapper.clear();
  });

  it('lists the sections registered on the page', async () => {
    renderControl();

    await userEvent.click(screen.getByRole('button', {name: 'Reorder sections'}));

    expect(await screen.findByText('Reorder sections')).toBeInTheDocument();
    // Each registered section gets a hide toggle in the control.
    expect(screen.getByRole('button', {name: 'Hide Tags'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Hide Breadcrumbs'})).toBeInTheDocument();
  });

  it('toggles a section between hidden and visible', async () => {
    renderControl();

    await userEvent.click(screen.getByRole('button', {name: 'Reorder sections'}));

    const hideTags = await screen.findByRole('button', {name: 'Hide Tags'});
    await userEvent.click(hideTags);

    expect(await screen.findByRole('button', {name: 'Show Tags'})).toBeInTheDocument();
  });
});
