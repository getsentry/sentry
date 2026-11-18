import {Flex} from '@sentry/scraps/layout';

import {TextTourAction, TourAction, TourGuideSurface} from './components';

describe('TourGuide', () => {
  function Guide({isFirst}: {isFirst: boolean}) {
    return (
      // Padding prevents rootElement.screenshot() from clipping the focus ring.
      <div style={{padding: 16}}>
        <TourGuideSurface
          positionProps={{
            role: 'dialog',
            tabIndex: -1,
            'aria-labelledby': 'title',
            'data-focus-ring': isFirst || undefined,
          }}
          arrowProps={{placement: 'bottom', style: undefined}}
          title="Settings have moved"
          titleId="title"
          description="Find your organization and project settings in the menu."
          descriptionId="description"
          actions={
            <Flex gap="sm">
              <TextTourAction>Previous</TextTourAction>
              <TourAction>Next</TourAction>
            </Flex>
          }
          stepCount={isFirst ? 1 : 2}
          stepTotal={2}
          handleDismiss={() => {}}
        />
      </div>
    );
  }

  it.snapshot('first step focused', () => <Guide isFirst />, {
    tags: {area: 'core', state: 'focus-visible'},
    interaction: {focusVisible: '[role="dialog"]'},
  });

  it.snapshot('later step focused', () => <Guide isFirst={false} />, {
    tags: {area: 'core', state: 'focus-visible'},
    interaction: {focusVisible: '[role="dialog"]'},
  });
});
