import styled from '@emotion/styled';

import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import {IconPanel} from 'sentry/icons';
import useUrlParam from 'sentry/utils/replays/hooks/useUrlParams';

const LAYOUT_NAMES = ['topbar', 'sidebar_left', 'sidebar_right'];

function getLayoutIcon(layout: string) {
  const layoutToDir = {
    sidebar_right: 'right',
    sidebar_left: 'left',
    topbar: 'up',
  };
  const dir = layout in layoutToDir ? layoutToDir[layout] : 'up';
  return <IconPanel color="gray500" size="sm" direction={dir} />;
}

type Props = {};

function ChooseLayout({}: Props) {
  const {getParamValue, setParamValue} = useUrlParam('l_page', 'topbar');
  return (
    <RelativeContainer>
      <DropdownControl
        label={getLayoutIcon(getParamValue())}
        buttonProps={{size: 'xs'}}
        alwaysRenderMenu={false}
        alignRight
      >
        {LAYOUT_NAMES.map(key => (
          <DropdownItem
            key={key}
            href={`#${key}`}
            onClick={() => {
              setParamValue(key);
            }}
          >
            <Icon>{getLayoutIcon(key)}</Icon>
          </DropdownItem>
        ))}
      </DropdownControl>
    </RelativeContainer>
  );
}
const RelativeContainer = styled('div')`
  position: relative;
`;

const Icon = styled('div')`
  text-align: center;
`;

export default ChooseLayout;
