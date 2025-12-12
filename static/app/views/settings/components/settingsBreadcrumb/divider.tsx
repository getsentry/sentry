import {IconChevron} from 'sentry/icons';
import {chonkStyled} from 'sentry/utils/theme/theme';

const DividerIcon = chonkStyled(IconChevron)`
color: ${p => p.theme.subText};
`;

export default function Divider({isHover}: {isHover?: boolean}) {
  return <DividerIcon direction={isHover ? 'down' : 'right'} size="xs" />;
}
