import styled from '@emotion/styled';

import {IconChevron} from 'sentry/icons';
import {withChonk} from 'sentry/utils/theme/withChonk';

const ChonkDivider = styled(IconChevron)`
  color: ${p => p.theme.subText};
`;

const Icon = styled(IconChevron)`
  color: ${p => p.theme.colors.gray200};
`;

const DividerIcon = withChonk(Icon, ChonkDivider);

export default function Divider({isHover}: {isHover?: boolean}) {
  return <DividerIcon direction={isHover ? 'down' : 'right'} size="xs" />;
}
