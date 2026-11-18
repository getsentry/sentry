import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ActivityLineHeadline} from './activityLineItem/layout';
import {ActivityLineDotMarker} from './activityLineItem/marker';
import {Timeline} from './timeline';

describe('Activity timeline', () => {
  it.snapshot.each(['default', 'card'] as const)(
    'highlighted %s row',
    variant => (
      <Container background="primary" padding="lg 2xl" width="400px">
        <Timeline.Container>
          <Timeline.Item
            variant={variant}
            highlightedActivityId="123"
            marker={<ActivityLineDotMarker />}
            headline={<ActivityLineHeadline title="Resolved" timestamp="1h ago" />}
          >
            <Text>The fix was deployed.</Text>
          </Timeline.Item>
        </Timeline.Container>
      </Container>
    ),
    variant => ({tags: {area: 'core', variant}})
  );
});
