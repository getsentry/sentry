import type {Event} from '@sentry/types';

/**
 * NOTE: These types are still considered Beta and subject to change.
 * @hidden
 */
export interface FeedbackEvent extends Event {
  feedback: {
    contact_email: string;
    message: string;
    replay_id: string;
    url: string;
  };
  // TODO: Add this event type to Event
  // type: 'feedback_event';
}
