import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useNavContext} from 'sentry/components/nav/context';
import {NavButton, SidebarItem} from 'sentry/components/nav/primary/components';
import {NavLayout} from 'sentry/components/nav/types';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

export function CollapseButton() {
  const {isCollapsed, setIsCollapsed, layout} = useNavContext();

  if (layout !== NavLayout.SIDEBAR) {
    return null;
  }

  return (
    <SidebarItem>
      <NavButton
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? t('Expand') : t('Collapse')}
        isMobile={false}
      >
        <InteractionStateLayer />
        <IconChevron direction={isCollapsed ? 'right' : 'left'} isDouble />
      </NavButton>
    </SidebarItem>
  );
}
