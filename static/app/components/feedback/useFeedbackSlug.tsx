import {createParser, useQueryState} from 'nuqs';

type FeedbackSlug = {
  feedbackId: string;
  projectSlug: string;
};

const parseFeedbackSlug = createParser<FeedbackSlug>({
  parse: value => {
    if (value.includes(':')) {
      const [projectSlug, feedbackId] = value.split(':');
      return {projectSlug: projectSlug!, feedbackId: feedbackId!};
    }
    return {feedbackId: value, projectSlug: ''};
  },
  serialize: value =>
    value
      ? value.projectSlug
        ? `${value.projectSlug}:${value.feedbackId}`
        : value.feedbackId
      : '',
});

export const useFeedbackSlug = () => useQueryState('feedbackSlug', parseFeedbackSlug);
