import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import RepoLabel from 'app/components/repoLabel';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {FrameTag} from 'app/types';
import {Theme} from 'app/utils/theme';

type Props = {
  theme: Theme;
  tag: FrameTag;
};

function Tag({tag, theme}: Props) {
  switch (tag) {
    case FrameTag.PREFIX:
      return (
        <Tooltip title={t('This frame is used for grouping as prefix frame')}>
          <StyledRepoLabel background={theme.green300}>{'prefix'}</StyledRepoLabel>
        </Tooltip>
      );

    case FrameTag.SENTINEL:
      return (
        <Tooltip title={t('This frame is used for grouping as sentinel frame')}>
          <StyledRepoLabel background={theme.pink300}>{'sentinel'}</StyledRepoLabel>
        </Tooltip>
      );
    case FrameTag.GROUPING:
      return (
        <Tooltip title={t('This frame is used for grouping')}>
          <StyledRepoLabel>{'grouping'}</StyledRepoLabel>
        </Tooltip>
      );
    case FrameTag.IN_APP:
      return (
        <Tooltip title={t('This frame is from your application')}>
          <StyledRepoLabel background={theme.blue300}>{'in app'}</StyledRepoLabel>
        </Tooltip>
      );
    default:
      return null;
  }
}

export default withTheme(Tag);

const StyledRepoLabel = styled(RepoLabel)<{background?: string}>`
  ${p => p.background && `background: ${p.background};`}
`;
