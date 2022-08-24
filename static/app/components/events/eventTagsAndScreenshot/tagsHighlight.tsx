import {Event} from 'sentry/types/event';

import ContextSummary from '../contextSummary';

type Props = {
  event: Event;
};

function TagsHighlight({event}: Props) {
  return <ContextSummary event={event} />;
}

export default TagsHighlight;
