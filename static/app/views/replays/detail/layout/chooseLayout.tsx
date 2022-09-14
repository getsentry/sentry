import CompactSelect from 'sentry/components/forms/compactSelect';
import {IconExpand, IconPanel, IconTerminal} from 'sentry/icons';
import {t} from 'sentry/locale';
import useReplayLayout, {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';

const layoutToLabel: Record<LayoutKey, string> = {
  topbar: t('Player Top'),
  sidebar_left: t('Player Left'),
  sidebar_right: t('Player Right'),
  top: t('Top'),
  no_video: t('Data'),
  video_only: t('Video'),
};

const layoutToIcon: Record<LayoutKey, JSX.Element> = {
  topbar: <IconPanel size="sm" direction="up" />,
  sidebar_left: <IconPanel size="sm" direction="left" />,
  sidebar_right: <IconPanel size="sm" direction="right" />,
  top: <IconPanel size="sm" direction="right" />,
  no_video: <IconTerminal size="sm" />,
  video_only: <IconExpand size="sm" />,
};

function getLayoutIcon(layout: LayoutKey) {
  return layoutToIcon[layout];
}

type Props = {};

function ChooseLayout({}: Props) {
  const {getLayout, setLayout} = useReplayLayout();

  return (
    <CompactSelect
      triggerProps={{
        size: 'xs',
        icon: getLayoutIcon(getLayout()),
      }}
      triggerLabel=""
      value={getLayout()}
      placement="bottom right"
      onChange={opt => setLayout(opt?.value)}
      options={Object.entries(layoutToLabel).map(([value, label]) => ({
        value,
        label,
        leadingItems: getLayoutIcon(value as LayoutKey),
      }))}
    />
  );
}

export default ChooseLayout;
