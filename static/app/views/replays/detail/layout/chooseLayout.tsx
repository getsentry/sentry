import {Fragment} from 'react';
import styled from '@emotion/styled';

import CompactSelect from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useReplayLayout, {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';

const layoutToLabel: Record<LayoutKey, string> = {
  topbar: t('Player Top'),
  sidebar_left: t('Player Left'),
  sidebar_right: t('Player Right'),
  top: t('Top'),
  no_video: t('Data Only'),
  video_only: t('Video Only'),
};

type Props = {};

function ChooseLayout({}: Props) {
  const {getLayout, setLayout} = useReplayLayout();

  const currentLabel = layoutToLabel[getLayout()];
  return (
    <CompactSelect
      triggerProps={{size: 'xs'}}
      triggerLabel={
        <Fragment>
          Page Layout: <Current>{currentLabel}</Current>
        </Fragment>
      }
      value={getLayout()}
      position="bottom-end"
      onChange={opt => setLayout(opt?.value)}
      options={Object.entries(layoutToLabel).map(([value, label]) => ({
        value,
        label,
      }))}
    />
  );
}

const Current = styled('span')`
  font-weight: normal;
  padding-left: ${space(0.5)};
`;

export default ChooseLayout;
