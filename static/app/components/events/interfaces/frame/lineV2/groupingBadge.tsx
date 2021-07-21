import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import RepoLabel from 'app/components/repoLabel';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {FrameBadge} from 'app/types';
import {Theme} from 'app/utils/theme';

type Props = {
  theme: Theme;
  badge: FrameBadge;
};

function GroupingBadge({badge, theme}: Props) {
  switch (badge) {
    case FrameBadge.PREFIX:
      return (
        <Tooltip
          title={t('This frame is used for grouping as prefix frame')}
          containerDisplayMode="inline-flex"
        >
          <StyledRepoLabel background={theme.green300}>{'prefix'}</StyledRepoLabel>
        </Tooltip>
      );

    case FrameBadge.SENTINEL:
      return (
        <Tooltip
          title={t('This frame is used for grouping as sentinel frame')}
          containerDisplayMode="inline-flex"
        >
          <StyledRepoLabel background={theme.pink300}>{'sentinel'}</StyledRepoLabel>
        </Tooltip>
      );
    case FrameBadge.GROUPING:
      return (
        <Tooltip
          title={t('This frame is used for grouping')}
          containerDisplayMode="inline-flex"
        >
          <StyledRepoLabel>{'grouping'}</StyledRepoLabel>
        </Tooltip>
      );
    default: {
      Sentry.withScope(scope => {
        scope.setExtra('badge', badge);
        Sentry.captureException(new Error('Unknown grouping badge'));
      });
      return null;
    }
  }
}

export default withTheme(GroupingBadge);

const StyledRepoLabel = styled(RepoLabel)<{background?: string}>`
  ${p => p.background && `background: ${p.background};`}
`;
