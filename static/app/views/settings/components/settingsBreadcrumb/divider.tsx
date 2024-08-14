import {IconChevron} from 'sentry/icons';

type Props = {
  isHover?: boolean;
  isLast?: boolean;
};

function Divider({isHover, isLast}: Props) {
  return isLast ? null : (
    <IconChevron color="gray200" direction={isHover ? 'down' : 'right'} size="xs" />
  );
}

export default Divider;
