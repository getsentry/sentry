import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import EditHighlightsModal, {
  type EditHighlightsModalProps,
} from 'sentry/components/events/highlights/editHighlightsModal';
import {
  TEST_EVENT_CONTEXTS,
  TEST_EVENT_TAGS,
} from 'sentry/components/events/highlights/util.spec';
import ModalStore from 'sentry/stores/modalStore';
import type {Project} from 'sentry/types';

describe('EditHighlightsModal', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const event = EventFixture({
    contexts: TEST_EVENT_CONTEXTS,
    tags: TEST_EVENT_TAGS,
  });
  const url = `/projects/${organization.slug}/${project.slug}/`;
  const highlightTags = ['release', 'url', 'missingTag'];
  const highlightContext = {
    keyboard: ['brand', 'switches'],
    os: ['name'],
    missingType: ['missingKey'],
  };
  // For ease of testing, avoids converting 'os' -> 'client_os' -> 'Client Os'
  const highlightContextTitles = [
    'Keyboard: brand',
    'Keyboard: switches',
    'Client Os: Name',
    'Missing Type: missingKey',
  ];
  const highlightContextSet = new Set([
    'keyboard:brand',
    'keyboard:switches',
    'os:name',
    'missingType:missingKey',
  ]);

  const highlightPreset: Project['highlightPreset'] = {
    context: {presetType: ['presetKey']},
    tags: ['presetTag'],
  };
  const closeModal = jest.fn();

  function renderModal(editHighlightModalProps?: Partial<EditHighlightsModalProps>) {
    act(() => {
      openModal(
        modalProps => (
          <EditHighlightsModal
            event={event}
            project={project}
            highlightContext={highlightContext}
            highlightTags={highlightTags}
            highlightPreset={highlightPreset}
            {...editHighlightModalProps}
            {...modalProps}
          />
        ),
        {onClose: closeModal}
      );
    });
  }

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
    ModalStore.reset();
    renderGlobalModal();
  });

  it('should renders with basic functions', async function () {
    renderModal({highlightContext: {}, highlightTags: []});
    expect(screen.getByText('Edit Event Highlights')).toBeInTheDocument();
    expect(screen.getByTestId('highlights-preview-section')).toBeInTheDocument();
    expect(screen.getByTestId('highlights-empty-message')).toBeInTheDocument();
    expect(screen.getByTestId('highlights-save-info')).toBeInTheDocument();
    expect(screen.getByTestId('highlights-tag-section')).toBeInTheDocument();
    expect(screen.getByTestId('highlights-context-section')).toBeInTheDocument();

    const defaultButton = screen.getByRole('button', {name: 'Use Defaults'});
    await userEvent.click(defaultButton);
    expect(screen.queryByTestId('highlights-empty-message')).not.toBeInTheDocument();

    const updateProjectMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: project,
    });
    const cancelButton = screen.getByRole('button', {name: 'Cancel'});
    await userEvent.click(cancelButton);
    expect(updateProjectMock).not.toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();

    // Reopen the modal to test cancel button
    jest.resetAllMocks();
    renderModal({highlightContext: {}, highlightTags: []});
    const saveButton = screen.getByRole('button', {name: 'Apply to Project'});
    await userEvent.click(saveButton);
    expect(updateProjectMock).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
  });

  it('should update preview section from user selection', async function () {
    const updateProjectMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: project,
    });
    renderModal();

    // Existing Tags and Context Keys should be highlighted
    const previewSection = screen.getByTestId('highlights-preview-section');
    expect(screen.queryByTestId('highlights-empty-message')).not.toBeInTheDocument();

    highlightTags.forEach(tag => {
      const tagItem = within(previewSection).getByText(tag, {selector: 'div'});
      expect(tagItem).toBeInTheDocument();
    });
    const previewTagButtons = screen.queryAllByTestId('highlights-remove-tag');
    expect(previewTagButtons).toHaveLength(highlightTags.length);

    highlightContextTitles.forEach(titleString => {
      const contextItem = within(previewSection).getByText(titleString);
      expect(contextItem).toBeInTheDocument();
    });
    const previewCtxButtons = screen.queryAllByTestId('highlights-remove-ctx');
    expect(previewCtxButtons).toHaveLength(highlightContextTitles.length);

    // Default should unselect the current values
    const defaultButton = screen.getByRole('button', {name: 'Use Defaults'});
    await userEvent.click(defaultButton);
    highlightTags.forEach(tag => {
      const tagItem = within(previewSection).queryByText(tag, {selector: 'div'});
      expect(tagItem).not.toBeInTheDocument();
    });
    highlightContextTitles.forEach(titleString => {
      const contextItem = within(previewSection).queryByText(titleString);
      expect(contextItem).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', {name: 'Apply to Project'}));
    expect(updateProjectMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          highlightContext: highlightPreset.context,
          highlightTags: highlightPreset.tags,
        },
      })
    );
    expect(closeModal).toHaveBeenCalled();
  });

  it('should update tag section from user selection', async function () {
    const updateProjectMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: project,
    });
    renderModal({highlightContext: {}});

    const tagSection = screen.getByTestId('highlights-tag-section');
    const previewSection = screen.getByTestId('highlights-preview-section');
    const highlightTagSet = new Set(highlightTags);
    const previewTagButtons = screen.queryAllByTestId('highlights-remove-tag');
    expect(previewTagButtons).toHaveLength(highlightTags.length);

    // Reflects accurate values on first load
    const tagTestPromises = event.tags.map(async tag => {
      const tagItem = within(tagSection).getByText(tag.key);
      expect(tagItem).toBeInTheDocument();
      const isHighlighted = highlightTagSet.has(tag.key);
      const addButton = within(tagSection).getByRole('button', {
        name: `Add ${tag.key} tag to highlights`,
      });
      expect(tagItem).toHaveAttribute('aria-disabled', String(isHighlighted));
      expect(addButton).toHaveAttribute('aria-disabled', String(isHighlighted));
      if (!isHighlighted) {
        const previewTagItem = within(previewSection).queryByText(tag.key, {
          selector: 'div',
        });
        expect(previewTagItem).not.toBeInTheDocument();
        await userEvent.click(addButton);
      }
      const previewTagItem = within(previewSection).getByText(tag.key, {
        selector: 'div',
      });
      const removeButton = previewTagItem?.closest(
        "div[data-test-id='highlights-preview-tag']"
      )?.previousSibling;
      expect(removeButton).toBeEnabled();
    });
    await Promise.all(tagTestPromises);

    // All event tags should be present now
    await userEvent.click(screen.getByRole('button', {name: 'Apply to Project'}));
    expect(updateProjectMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          highlightContext: {},
          highlightTags: expect.arrayContaining(event.tags.map(t => t.key)),
        },
      })
    );
    expect(closeModal).toHaveBeenCalled();
  });

  it('should update context section from user selection', async function () {
    const updateProjectMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: project,
    });
    renderModal({highlightTags: []});

    const ctxSection = screen.getByTestId('highlights-context-section');
    const previewSection = screen.getByTestId('highlights-preview-section');
    const previewCtxButtons = screen.queryAllByTestId('highlights-remove-ctx');
    expect(previewCtxButtons).toHaveLength(Object.values(highlightContext).flat().length);

    // Reflects accurate values on first load
    const ctxTestPromises = Object.entries(event.contexts).map(
      async ([ctxType, ctxData]) => {
        const ctxHeader = within(ctxSection).getByText(new RegExp(ctxType, 'i'));
        expect(ctxHeader).toBeInTheDocument();
        const ctxContainer = ctxHeader.parentNode as HTMLElement;

        const ctxKeyPromises = Object.keys(ctxData).map(async ctxKey => {
          if (ctxKey === 'type') {
            return;
          }
          const ctxItem = within(ctxContainer).getByText(ctxKey);
          expect(ctxItem).toBeInTheDocument();

          const addButton = within(ctxContainer).getByRole('button', {
            name: `Add ${ctxKey} from ${ctxType} context to highlights`,
          });

          const isHighlighted = highlightContextSet.has(`${ctxType}:${ctxKey}`);
          expect(ctxItem).toHaveAttribute('aria-disabled', String(isHighlighted));
          expect(addButton).toHaveAttribute('aria-disabled', String(isHighlighted));
          if (!isHighlighted) {
            const previewCtxItem = within(previewSection).queryByText(
              new RegExp(`${ctxType}: ${ctxKey}`, 'i')
            );
            expect(previewCtxItem).not.toBeInTheDocument();
            await userEvent.click(addButton);
          }
        });
        await Promise.all(ctxKeyPromises);
      }
    );
    await Promise.all(ctxTestPromises);

    // These come from the event, and existing highlights
    const allHighlightCtxTitles = highlightContextTitles.concat([
      'Keyboard: switches',
      'Client Os: Version',
      'Runtime: Version',
      'Runtime: Name',
    ]);
    allHighlightCtxTitles.forEach(title => {
      const previewCtxItem = within(previewSection).getByText(title) as HTMLElement;
      const removeButton = previewCtxItem?.closest(
        "div[data-test-id='highlights-preview-ctx']"
      )?.previousSibling;
      expect(removeButton).toBeEnabled();
    });

    // All event tags should be present now
    await userEvent.click(screen.getByRole('button', {name: 'Apply to Project'}));
    expect(updateProjectMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          highlightContext: {
            client_os: ['name', 'version'],
            keyboard: ['brand', 'switches', 'percent'],
            missingType: ['missingKey'],
            os: ['name'],
            runtime: ['name', 'version'],
          },
          highlightTags: [],
        },
      })
    );
    expect(closeModal).toHaveBeenCalled();
  });
});
