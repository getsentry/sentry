import CompactSelect from 'sentry/components/forms/compactSelect';
import {IconPanel} from 'sentry/icons';
import {t} from 'sentry/locale';
import useReplayLayout, {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';

const layoutToLabel: Record<LayoutKey, string> = {
  topbar: t('Player Top'),
  sidebar_left: t('Player Left'),
  sidebar_right: t('Player Right'),
};

const layoutToDir: Record<LayoutKey, string> = {
  topbar: 'up',
  sidebar_left: 'left',
  sidebar_right: 'right',
};

function getLayoutIcon(layout: string) {
  const dir = layout in layoutToDir ? layoutToDir[layout] : 'up';
  return <IconPanel size="sm" direction={dir} />;
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
        leadingItems: getLayoutIcon(value),
      }))}
    />
  );
}

export default ChooseLayout;
