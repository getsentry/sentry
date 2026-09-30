import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Heading} from '@sentry/scraps/text';

import {Demo} from 'sentry/stories/demo';

import {StoryHeading} from './storyHeading';
import {StoryTableOfContents} from './storyTableOfContents';
import {StoryContextProvider} from './useStory';

describe('StoryTableOfContents', () => {
  beforeEach(() => {
    jest.spyOn(window, 'MutationObserver').mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: () => [],
    }));
  });
  it('uses compiled IDs for both the contents and heading copy links', () => {
    render(
      <StoryContextProvider story={{exports: {}, filename: 'test.mdx'}}>
        <main>
          <StoryHeading as="h3" id="first">
            First
          </StoryHeading>
          <StoryHeading as="h4" id="first-details">
            Details
          </StoryHeading>
          <StoryHeading as="h3" id="second">
            Second
          </StoryHeading>
          <StoryHeading as="h4" id="second-details">
            Details
          </StoryHeading>
          <Demo data-test-id="custom-demo">
            <Heading as="h3">Demo heading</Heading>
          </Demo>
        </main>
        <StoryTableOfContents />
      </StoryContextProvider>
    );

    const detailLinks = screen.getAllByRole('link', {name: 'Details'});
    expect(detailLinks[0]).toHaveAttribute('href', '#first-details');
    expect(detailLinks[1]).toHaveAttribute('href', '#second-details');
    expect(document.querySelectorAll('a[href="#first-details"]')).toHaveLength(2);
    expect(document.querySelectorAll('a[href="#second-details"]')).toHaveLength(2);
    expect(screen.queryByRole('link', {name: 'Demo heading'})).not.toBeInTheDocument();
  });

  it('scrolls to a section after navigation, including selecting it again after a page result', async () => {
    const scroll = jest.fn();
    const {router} = render(
      <StoryContextProvider story={{exports: {}, filename: 'test.mdx'}}>
        <main>
          <StoryHeading
            as="h3"
            id="featurebadge"
            ref={element => {
              if (element) {
                element.scrollIntoView = scroll;
              }
            }}
          >
            FeatureBadge
          </StoryHeading>
          <StoryHeading as="h3" id="tag">
            Tag
          </StoryHeading>
        </main>
        <StoryTableOfContents />
      </StoryContextProvider>,
      {initialRouterConfig: {location: {pathname: '/scraps/core/badge/#featurebadge'}}}
    );

    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
    act(() => router.navigate('/scraps/core/badge/'));
    act(() => router.navigate('/scraps/core/badge/#featurebadge'));
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(2));
  });
});
