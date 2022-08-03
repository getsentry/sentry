import CompactSelect from 'sentry/components/forms/compactSelect';
import {IconPanel} from 'sentry/icons';
import useUrlParam from 'sentry/utils/replays/hooks/useUrlParams';
import {handleDefaultLayout} from 'sentry/views/replays/detail/layout/utils';

const LAYOUT_NAMES = ['topbar', 'sidebar_left', 'sidebar_right'];
const layoutLabels = {
  sidebar_right: 'Player Right',
  sidebar_left: 'Player Left',
  topbar: 'Player Top',
};

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
  const {getParamValue, setParamValue} = useUrlParam('l_page', handleDefaultLayout());
  return (
    <CompactSelect
      triggerProps={{
        size: 'xs',
        icon: getLayoutIcon(getParamValue()),
      }}
      triggerLabel=""
      value={getParamValue()}
      placement="bottom right"
      onChange={opt => setParamValue(opt?.value)}
      options={LAYOUT_NAMES.map(key => ({
        value: key,
        label: layoutLabels[key],
        leadingItems: getLayoutIcon(key),
      }))}
    />
  );
}

export default ChooseLayout;
