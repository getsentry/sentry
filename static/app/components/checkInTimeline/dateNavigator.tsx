import {type BaseButtonProps, Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {DateNavigation} from './hooks/useDateNavigation';

interface Props extends BaseButtonProps {
  dateNavigation: DateNavigation;
  /**
   * Direction to navigate
   */
  direction: 'back' | 'forward';
}

export function DateNavigator({direction, dateNavigation, ...props}: Props) {
  const isForward = direction === 'forward';

  const title = isForward
    ? t('Next %s', dateNavigation.label)
    : t('Previous %s', dateNavigation.label);

  const action = isForward
    ? dateNavigation.navigateToNextPeriod
    : dateNavigation.navigateToPreviousPeriod;

  const disabled = isForward && dateNavigation.endIsNow;

  const iconDirection = isForward ? 'right' : 'left';

  return (
    <Button
      icon={<IconChevron direction={iconDirection} />}
      title={!disabled && title}
      aria-label={title}
      onClick={action}
      disabled={disabled}
      {...props}
    />
  );
}
