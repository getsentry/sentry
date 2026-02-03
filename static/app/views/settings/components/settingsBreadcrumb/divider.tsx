import {IconChevron} from 'sentry/icons';

export default function Divider({isHover}: {isHover?: boolean}) {
  return <IconChevron variant="muted" direction={isHover ? 'down' : 'right'} size="xs" />;
}
