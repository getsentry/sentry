import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Heading} from '@sentry/scraps/text';

import {Demo} from 'sentry/stories/demo';

import {StoryHeading} from './storyHeading';
import {StoryTableOfContents} from './storyTableOfContents';
import {StoryContextProvider} from './useStory';

class MockIntersectionObserver {
  disconnect = jest.fn();
  observe = jest.fn();
}

class MockMutationObserver {
  disconnect = jest.fn();
  observe = jest.fn();
}

describe('StoryTableOfContents', () => {
  beforeEach(() => {
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
    window.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;
  });

  it('excludes headings inside demos', () => {
    render(
      <StoryContextProvider story={{exports: {}, filename: 'test.mdx'}}>
        <main>
          <StoryHeading as="h2">Section</StoryHeading>
          <Demo data-test-id="custom-demo">
            <Heading as="h3">Demo heading</Heading>
          </Demo>
        </main>
        <StoryTableOfContents />
      </StoryContextProvider>
    );

    expect(screen.queryByRole('link', {name: 'Demo heading'})).not.toBeInTheDocument();
  });

  it('links duplicate titles independently', () => {
    render(
      <StoryContextProvider story={{exports: {}, filename: 'test.mdx'}}>
        <main>
          <StoryHeading as="h2">First section</StoryHeading>
          <StoryHeading as="h3">Details</StoryHeading>
          <StoryHeading as="h2">Second section</StoryHeading>
          <StoryHeading as="h3">Details</StoryHeading>
        </main>
        <StoryTableOfContents />
      </StoryContextProvider>
    );

    const detailLinks = screen.getAllByRole('link', {name: 'Details'});
    expect(detailLinks).toHaveLength(2);
    expect(detailLinks[0]).toHaveAttribute('href', '#first-section-details');
    expect(detailLinks[1]).toHaveAttribute('href', '#second-section-details');
    expect(document.querySelectorAll('a[href="#first-section-details"]')).toHaveLength(2);
    expect(document.querySelectorAll('a[href="#second-section-details"]')).toHaveLength(
      2
    );
  });
});
