import styled from '@emotion/styled';

import {IconChevron} from 'sentry/icons';

const ChonkDivider = styled(IconChevron)`
  color: ${p => p.theme.subText};
`;

const DividerIcon = ChonkDivider;

export default function Divider({isHover}: {isHover?: boolean}) {
  return <DividerIcon direction={isHover ? 'down' : 'right'} size="xs" />;
}
