import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {TagValueAutocomplete} from 'sentry/views/settings/project/dynamicSampling/modals/specificConditionsModal/tagValueAutocomplete';

describe('TagValueAutocomplete', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/environment/values/',
      method: 'GET',
      body: [
        {value: 'dev', count: 97},
        {value: 'development', count: 199},
      ],
    });
  });

  it('correctly offers new value option', async function () {
    render(
      <TagValueAutocomplete
        onChange={() => {}}
        orgSlug="org-slug"
        projectId="1"
        tagKey="environment"
        value=""
        ariaLabel="Search or add an environment"
      />
    );

    const input = screen.getByLabelText('Search or add an environment');

    // Type an empty string into release field
    userEvent.paste(input, ' ');

    // Since empty strings are invalid, autocomplete does not suggest creating a new empty label
    await waitFor(() => {
      expect(
        screen.queryByText(textWithMarkupMatcher('Add " "'))
      ).not.toBeInTheDocument();
    });

    // Clear the input
    userEvent.clear(input);

    // Type an existing option
    userEvent.paste(input, 'development');

    // Since this option already exists, we do not offer to create it
    await waitFor(() => {
      expect(
        screen.queryByText(textWithMarkupMatcher('Add "development"'))
      ).not.toBeInTheDocument();
    });

    // Clear the input
    userEvent.clear(input);

    // Enter a valid string that is not in options already
    userEvent.paste(input, 'deve');

    // Assert that we offer to create that option
    expect(
      await screen.findByText(textWithMarkupMatcher('Add "deve"'))
    ).toBeInTheDocument();
  });

  it('displays the counts of tag values', async function () {
    render(
      <TagValueAutocomplete
        onChange={() => {}}
        orgSlug="org-slug"
        projectId="1"
        tagKey="environment"
        value=""
        ariaLabel="Search or add an environment"
      />
    );

    const input = screen.getByLabelText('Search or add an environment');

    // Open the select
    userEvent.click(input);

    // Assert the value counts are there
    expect(await screen.findByText(199)).toBeInTheDocument();
    expect(screen.getByText(97)).toBeInTheDocument();

    // Type to filter to only one option
    userEvent.paste(input, 'development');

    // Assert the filtered out value count is not there anymore
    expect(await screen.findByText(199)).toBeInTheDocument();
    expect(screen.queryByText(97)).not.toBeInTheDocument();
  });

  it('accepts prependOptions', async function () {
    render(
      <TagValueAutocomplete
        onChange={() => {}}
        orgSlug="org-slug"
        projectId="1"
        tagKey="environment"
        value=""
        ariaLabel="Search or add an environment"
        prependOptions={[{value: 'prepended', label: 'Prepended'}]}
      />
    );

    // Open the select
    userEvent.click(screen.getByLabelText('Search or add an environment'));

    // Assert the custom prepended options are there
    expect(await screen.findByText('Prepended')).toBeInTheDocument();
  });
});
