import styled from '@emotion/styled';

import {IconChevron} from 'sentry/icons';
import {chonkStyled} from 'sentry/utils/theme/theme';
import {withChonk} from 'sentry/utils/theme/withChonk';

const ChonkDivider = chonkStyled(IconChevron)`
color: ${p => p.theme.subText};
`;

const Icon = styled(IconChevron)`
  color: ${p => p.theme.gray200};
`;

const DividerIcon = withChonk(Icon, ChonkDivider);

export default function Divider({isHover}: {isHover?: boolean}) {
  return <DividerIcon direction={isHover ? 'down' : 'right'} size="xs" />;
}
