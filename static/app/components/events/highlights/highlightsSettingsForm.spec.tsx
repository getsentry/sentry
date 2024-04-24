import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import HighlightsSettingsForm from 'sentry/components/events/highlights/highlightsSettingsForm';

describe('HighlightsSettingForm', function () {
  const organization = OrganizationFixture({features: ['event-tags-tree-ui']});
  const highlightTags = ['environment', 'handled', 'release', 'url'];
  const highlightContext = {
    user: ['email'],
    browser: ['name', 'version'],
  };
  const project = ProjectFixture({highlightContext, highlightTags});

  beforeEach(async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: {...project, highlightTags, highlightContext},
    });
    render(<HighlightsSettingsForm projectSlug={project.slug} />, {organization});
    await screen.findByText('Highlights');
  });

  it('should render with highlights from detailed project', function () {
    expect(screen.getByText('Highlighted Tags')).toBeInTheDocument();
    const tagInput = screen.getByRole('textbox', {name: 'Highlighted Tags'});
    expect(tagInput).toHaveValue(highlightTags.join('\n'));

    expect(screen.getByText('Highlighted Context')).toBeInTheDocument();
    const contextInput = screen.getByRole('textbox', {name: 'Highlighted Context'});
    expect(contextInput).toHaveValue(JSON.stringify(highlightContext, null, 2));
  });

  it('should allow the Highlight Tags field to mutate highlights', async function () {
    const newTag = 'orchid';
    const url = `/projects/${organization.slug}/${project.slug}/`;
    const updateProjectMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: {...project, highlightTags: [...highlightTags, newTag], highlightContext},
    });

    expect(screen.getByText('Highlighted Tags')).toBeInTheDocument();
    const tagInput = screen.getByRole('textbox', {name: 'Highlighted Tags'});

    await userEvent.type(tagInput, `\n${newTag}`);
    await userEvent.click(screen.getByText('Highlights'));
    expect(updateProjectMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {highlightTags: [...highlightTags, newTag]},
      })
    );
  });

  it('should allow the Highlight Context field to mutate highlights', async function () {
    const newContext = {flower: ['leafCount', 'petalCount']};
    const url = `/projects/${organization.slug}/${project.slug}/`;
    const updateProjectMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: {...project, highlightTags, highlightContext: newContext},
    });

    expect(screen.getByText('Highlighted Context')).toBeInTheDocument();
    const contextInput = screen.getByRole('textbox', {name: 'Highlighted Context'});

    await userEvent.clear(contextInput);
    await userEvent.paste(JSON.stringify(newContext));
    await userEvent.click(screen.getByText('Highlights'));

    expect(updateProjectMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {highlightContext: newContext},
      })
    );
  });
});
