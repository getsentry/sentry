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
import ModalStore from 'sentry/stores/modalStore';
import type {Project} from 'sentry/types/project';
import * as analytics from 'sentry/utils/analytics';

import {TEST_EVENT_CONTEXTS, TEST_EVENT_TAGS} from './testUtils';

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
  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

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
  });

  it('should renders with basic functions', async function () {
    renderModal({highlightContext: {}, highlightTags: []});
    renderGlobalModal();
    expect(screen.getByText('Edit Event Highlights')).toBeInTheDocument();
    expect(screen.getByTestId('highlights-preview-section')).toBeInTheDocument();
    expect(screen.getByTestId('highlights-empty-preview')).toBeInTheDocument();
    expect(screen.getByTestId('highlights-save-info')).toBeInTheDocument();
    expect(screen.getByTestId('highlights-tag-section')).toBeInTheDocument();
    expect(screen.getByTestId('highlights-context-section')).toBeInTheDocument();

    const defaultButton = screen.getByRole('button', {name: 'Use Defaults'});
    await userEvent.click(defaultButton);
    expect(analyticsSpy).toHaveBeenCalledWith(
      'highlights.edit_modal.use_default_clicked',
      expect.anything()
    );
    expect(screen.queryByTestId('highlights-empty-preview')).not.toBeInTheDocument();

    const updateProjectMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: project,
    });
    const cancelButton = screen.getByRole('button', {name: 'Cancel'});
    await userEvent.click(cancelButton);
    expect(analyticsSpy).toHaveBeenCalledWith(
      'highlights.edit_modal.cancel_clicked',
      expect.anything()
    );
    expect(updateProjectMock).not.toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();

    // Reopen the modal to test cancel button
    jest.resetAllMocks();
    renderModal({highlightContext: {}, highlightTags: []});
    const saveButton = screen.getByRole('button', {name: 'Apply to Project'});
    await userEvent.click(saveButton);
    expect(analyticsSpy).toHaveBeenCalledWith(
      'highlights.edit_modal.save_clicked',
      expect.anything()
    );
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
    renderGlobalModal();

    // Existing Tags and Context Keys should be highlighted
    const previewSection = screen.getByTestId('highlights-preview-section');
    expect(screen.queryByTestId('highlights-empty-preview')).not.toBeInTheDocument();
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

    await userEvent.click(previewTagButtons[0]!);
    expect(analyticsSpy).toHaveBeenCalledWith(
      'highlights.edit_modal.remove_tag',
      expect.anything()
    );
    expect(screen.queryAllByTestId('highlights-remove-tag')).toHaveLength(
      previewTagButtons.length - 1
    );

    await userEvent.click(previewCtxButtons[0]!);
    expect(analyticsSpy).toHaveBeenCalledWith(
      'highlights.edit_modal.remove_context_key',
      expect.anything()
    );
    expect(screen.queryAllByTestId('highlights-remove-ctx')).toHaveLength(
      previewCtxButtons.length - 1
    );

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
    renderGlobalModal();

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
    expect(analyticsSpy).toHaveBeenCalledTimes(8);
    expect(analyticsSpy).toHaveBeenCalledWith(
      'highlights.edit_modal.add_tag',
      expect.anything()
    );

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
    renderGlobalModal();

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
    expect(analyticsSpy).toHaveBeenCalledTimes(5);
    expect(analyticsSpy).toHaveBeenCalledWith(
      'highlights.edit_modal.add_context_key',
      expect.anything()
    );
    // Combine existing highlight context titles, with new ones that were selected above
    const allHighlightCtxTitles = highlightContextTitles.concat([
      'Keyboard: switches',
      'Client Os: Version',
      'Runtime: Version',
      'Runtime: Name',
    ]);
    allHighlightCtxTitles.forEach(title => {
      const previewCtxItem = within(previewSection).getByText(title);
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

  it('should update sections from search input', async function () {
    renderModal();
    renderGlobalModal();
    const tagCount = TEST_EVENT_TAGS.length;
    expect(screen.getAllByTestId('highlight-tag-option')).toHaveLength(tagCount);
    const tagInput = screen.getByTestId('highlights-tag-search');
    await userEvent.type(tagInput, 'le');
    expect(screen.getAllByTestId('highlight-tag-option')).toHaveLength(3); // handled, level, release
    await userEvent.clear(tagInput);
    await userEvent.type(tagInput, 'gibberish');
    expect(screen.queryAllByTestId('highlight-tag-option')).toHaveLength(0);
    expect(screen.getByTestId('highlights-empty-tags')).toBeInTheDocument();
    await userEvent.clear(tagInput);
    expect(screen.getAllByTestId('highlight-tag-option')).toHaveLength(tagCount);

    const ctxCount = Object.values(TEST_EVENT_CONTEXTS)
      .flatMap(Object.keys)
      .filter(k => k !== 'type').length;
    expect(screen.getAllByTestId('highlight-context-option')).toHaveLength(ctxCount);
    const contextInput = screen.getByTestId('highlights-context-search');
    await userEvent.type(contextInput, 'name'); // client_os.name, runtime.name
    expect(screen.getAllByTestId('highlight-context-option')).toHaveLength(2);
    await userEvent.clear(contextInput);
    await userEvent.type(contextInput, 'gibberish');
    expect(screen.queryAllByTestId('highlight-context-option')).toHaveLength(0);
    expect(screen.getByTestId('highlights-empty-context')).toBeInTheDocument();
    await userEvent.clear(contextInput);
    expect(screen.getAllByTestId('highlight-context-option')).toHaveLength(ctxCount);
  });
});
