import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import RepoLabel from 'app/components/repoLabel';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {FrameCategory} from 'app/types';
import {Theme} from 'app/utils/theme';

type Props = {
  theme: Theme;
  category: FrameCategory;
};

function Category({category, theme}: Props) {
  switch (category) {
    case FrameCategory.PREFIX:
      return (
        <Tooltip title={t('This frame is used for grouping as prefix frame')}>
          <StyledRepoLabel background={theme.green300}>{'prefix'}</StyledRepoLabel>
        </Tooltip>
      );

    case FrameCategory.SENTINEL:
      return (
        <Tooltip title={t('This frame is used for grouping as sentinel frame')}>
          <StyledRepoLabel background={theme.pink300}>{'sentinel'}</StyledRepoLabel>
        </Tooltip>
      );
    case FrameCategory.GROUPING:
      return (
        <Tooltip title={t('This frame is used for grouping')}>
          <StyledRepoLabel>{'grouping'}</StyledRepoLabel>
        </Tooltip>
      );
    case FrameCategory.IN_APP:
      return (
        <Tooltip title={t('This frame is from your application')}>
          <StyledRepoLabel background={theme.blue300}>{'in app'}</StyledRepoLabel>
        </Tooltip>
      );
    default:
      return null;
  }
}

export default withTheme(Category);

const StyledRepoLabel = styled(RepoLabel)<{background?: string}>`
  ${p => p.background && `background: ${p.background};`}
`;
