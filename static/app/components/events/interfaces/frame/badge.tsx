import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import RepoLabel from 'app/components/repoLabel';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {FrameBadge} from 'app/types';
import {Theme} from 'app/utils/theme';

type Props = {
  theme: Theme;
  badge: FrameBadge;
};

function Badge({badge, theme}: Props) {
  switch (badge) {
    case FrameBadge.PREFIX:
      return (
        <Tooltip title={t('This frame is used for grouping as prefix frame')}>
          <StyledRepoLabel background={theme.green300}>{'prefix'}</StyledRepoLabel>
        </Tooltip>
      );

    case FrameBadge.SENTINEL:
      return (
        <Tooltip title={t('This frame is used for grouping as sentinel frame')}>
          <StyledRepoLabel background={theme.pink300}>{'sentinel'}</StyledRepoLabel>
        </Tooltip>
      );
    case FrameBadge.GROUPING:
      return (
        <Tooltip title={t('This frame is used for grouping')}>
          <StyledRepoLabel>{'grouping'}</StyledRepoLabel>
        </Tooltip>
      );
    case FrameBadge.IN_APP:
      return (
        <Tooltip title={t('This frame is from your application')}>
          <StyledRepoLabel background={theme.blue300}>{'in app'}</StyledRepoLabel>
        </Tooltip>
      );
    default:
      return null;
  }
}

export default withTheme(Badge);

const StyledRepoLabel = styled(RepoLabel)<{background?: string}>`
  ${p => p.background && `background: ${p.background};`}
`;
