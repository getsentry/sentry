import DetailedError from 'sentry/components/errors/detailedError';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t} from 'sentry/locale';

type Props = {
  environments: string[];
  onRetry?: (e: React.MouseEvent) => void;
};

function GroupEventDetailsLoadingError({onRetry, environments}: Props) {
  const reasons = [
    t('The events are still processing and are on their way'),
    t('The events have been deleted'),
    t('There is an internal systems error or active issue'),
  ];

  let message: React.ReactNode;

  if (environments.length === 0) {
    // All Environments case
    message = (
      <div>
        <p>{t('This could be due to a handful of reasons:')}</p>
        <List symbol="bullet">
          {reasons.map((reason, i) => (
            <ListItem key={i}>{reason}</ListItem>
          ))}
        </List>
      </div>
    );
  } else {
    message = (
      <div>{t('No events were found for the currently selected environments')}</div>
    );
  }

  return (
    <DetailedError
      onRetry={environments.length === 0 ? onRetry : undefined}
      heading={t('Sorry, the events for this issue could not be found.')}
      message={message}
    />
  );
}

export default GroupEventDetailsLoadingError;
