import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import HighlightsSettingsForm from 'sentry/components/events/highlights/highlightsSettingsForm';
import * as analytics from 'sentry/utils/analytics';

describe('HighlightsSettingForm', function () {
  const organization = OrganizationFixture();
  const highlightTags = ['environment', 'handled', 'release', 'url'];
  const highlightContext = {
    user: ['email'],
    browser: ['name', 'version'],
  };
  const project = ProjectFixture({highlightContext, highlightTags});
  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: {...project, highlightTags, highlightContext},
    });
  });

  it('should render with highlights from detailed project', async function () {
    render(<HighlightsSettingsForm projectSlug={project.slug} />, {organization});
    await screen.findByText('Highlights');

    expect(screen.getByText('Highlighted Tags')).toBeInTheDocument();
    const tagInput = screen.getByRole('textbox', {name: 'Highlighted Tags'});
    expect(tagInput).toHaveValue(highlightTags.join('\n'));

    expect(screen.getByText('Highlighted Context')).toBeInTheDocument();
    const contextInput = screen.getByRole('textbox', {name: 'Highlighted Context'});
    expect(contextInput).toHaveValue(JSON.stringify(highlightContext, null, 2));
  });

  it('should allow the Highlight Tags field to mutate highlights', async function () {
    render(<HighlightsSettingsForm projectSlug={project.slug} />, {organization});
    await screen.findByText('Highlights');

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
    expect(analyticsSpy).toHaveBeenCalledWith(
      'highlights.project_settings.updated_manually',
      expect.anything()
    );
  });

  it('should allow the Highlight Context field to mutate highlights', async function () {
    render(<HighlightsSettingsForm projectSlug={project.slug} />, {organization});
    await screen.findByText('Highlights');

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
