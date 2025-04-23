import {IconHappy, IconMeh, IconSad} from 'sentry/icons';

export const getSentimentIcon = (type: string) => {
  switch (type) {
    case 'positive':
      return <IconHappy color="green400" />;
    case 'negative':
      return <IconSad color="red400" />;
    default:
      return <IconMeh color="yellow400" />;
  }
};

export const getSentimentType = (type: string) => {
  switch (type) {
    case 'positive':
      return 'success';
    case 'negative':
      return 'error';
    default:
      return 'warning';
  }
};
