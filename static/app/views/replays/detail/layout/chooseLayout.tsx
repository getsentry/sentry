import CompactSelect from 'sentry/components/forms/compactSelect';
import {IconPanel} from 'sentry/icons';
import useReplayLayout, {layoutLabels} from 'sentry/utils/replays/hooks/useReplayLayout';

function getLayoutIcon(layout: string) {
  const layoutToDir = {
    sidebar_right: 'right',
    sidebar_left: 'left',
    topbar: 'up',
  };
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
      options={Object.entries(layoutLabels).map(([value, label]) => ({
        value,
        label,
        leadingItems: getLayoutIcon(value),
      }))}
    />
  );
}

export default ChooseLayout;
