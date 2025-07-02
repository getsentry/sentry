import styled from '@emotion/styled';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import DeprecatedDropdownMenu from 'sentry/components/deprecatedDropdownMenu';
import Hook from 'sentry/components/hook';
import SidebarItem from 'sentry/components/sidebar/sidebarItem';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {useChonkPrompt} from 'sentry/utils/theme/useChonkPrompt';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import {useUser} from 'sentry/utils/useUser';
import {useNavPrompts} from 'sentry/views/nav/useNavPrompts';

import SidebarDropdownMenu from './sidebarDropdownMenu.styled';
import SidebarMenuItem from './sidebarMenuItem';
import type {CommonSidebarProps} from './types';

type Props = Pick<
  CommonSidebarProps,
  'collapsed' | 'hidePanel' | 'orientation' | 'hasNewNav'
> & {
  organization: Organization;
};

function SidebarHelp({orientation, collapsed, hidePanel, organization}: Props) {
  const user = useUser();
  const navPrompts = useNavPrompts({
    collapsed,
    organization,
  });
  const chonkPrompts = useChonkPrompt();
  const {mutate: mutateUserOptions} = useMutateUserOptions();
  const openForm = useFeedbackForm();

  return (
    <DeprecatedDropdownMenu
      onOpen={() => {
        navPrompts.onOpenHelpMenu();
        chonkPrompts.dismissDotIndicatorPrompt();
      }}
    >
      {({isOpen, getActorProps, getMenuProps}) => (
        <HelpRoot>
          <HelpActor {...getActorProps({onClick: hidePanel})}>
            <SidebarItem
              data-test-id="help-sidebar"
              orientation={orientation}
              collapsed={collapsed}
              hasPanel={false}
              icon={<IconQuestion size="md" />}
              label={t('Help')}
              id="help"
            />
            {(navPrompts.shouldShowHelpMenuDot ||
              chonkPrompts.showDotIndicatorPrompt) && (
              <IndicatorDot
                orientation={orientation}
                collapsed={collapsed}
                data-test-id="help-menu-dot"
              />
            )}
          </HelpActor>

          {isOpen && (
            <HelpMenu {...getMenuProps({})} orientation={orientation}>
              <SidebarMenuItem
                data-test-id="search-docs-and-faqs"
                onClick={() => openHelpSearchModal({organization})}
              >
                {t('Search Support, Docs and More')}
              </SidebarMenuItem>
              {!isDemoModeActive() && (
                // Sentry zendesk is public but we hide it in demo mode to limit the amount of potential spam
                <SidebarMenuItem href="https://sentry.zendesk.com/hc/en-us">
                  {t('Visit Help Center')}
                </SidebarMenuItem>
              )}
              <SidebarMenuItem href="https://discord.com/invite/sentry">
                {t('Join our Discord')}
              </SidebarMenuItem>
              <Hook name="sidebar:help-menu" organization={organization} />
              {openForm ? (
                <SidebarMenuItem
                  onClick={() => {
                    openForm({
                      tags: {
                        ['feedback.source']: 'navigation_sidebar_legacy',
                      },
                    });
                  }}
                >
                  {t('Give Feedback')}
                </SidebarMenuItem>
              ) : null}
              {organization?.features?.includes('navigation-sidebar-v2') && (
                <SidebarMenuItem
                  onClick={() => {
                    mutateUserOptions({prefersStackedNavigation: true});
                    trackAnalytics(
                      'navigation.help_menu_opt_in_stacked_navigation_clicked',
                      {
                        organization,
                      }
                    );
                  }}
                >
                  {t('Try New Navigation')} <FeatureBadge type="new" />
                </SidebarMenuItem>
              )}
              {organization?.features?.includes('chonk-ui') ? (
                user.options.prefersChonkUI ? (
                  <SidebarMenuItem
                    onClick={() => {
                      mutateUserOptions({prefersChonkUI: false});
                      trackAnalytics('navigation.help_menu_opt_out_chonk_ui_clicked', {
                        organization,
                      });
                    }}
                  >
                    {t('Switch Back To Our Old Look')}
                  </SidebarMenuItem>
                ) : (
                  <SidebarMenuItem
                    onClick={() => {
                      mutateUserOptions({prefersChonkUI: true});
                      trackAnalytics('navigation.help_menu_opt_in_chonk_ui_clicked', {
                        organization,
                      });
                    }}
                  >
                    {t('Try Our New Look')} <FeatureBadge type="beta" />
                  </SidebarMenuItem>
                )
              ) : null}
            </HelpMenu>
          )}
        </HelpRoot>
      )}
    </DeprecatedDropdownMenu>
  );
}

export default SidebarHelp;

const HelpRoot = styled('div')`
  position: relative;
`;

// This exists to provide a styled actor for the dropdown. Making the actor a regular,
// non-styled react component causes some issues with toggling correctly because of
// how refs are handled.
const HelpActor = styled('div')``;

const HelpMenu = styled('div', {shouldForwardProp: p => p !== 'orientation'})<{
  orientation: Props['orientation'];
}>`
  ${SidebarDropdownMenu};
  ${p => (p.orientation === 'left' ? 'bottom: 100%' : `top: ${space(4)}; right: 0px;`)}
`;

const IndicatorDot = styled('div')<{
  collapsed: Props['collapsed'];
  orientation: Props['orientation'];
}>`
  position: absolute;
  top: ${p => (p.orientation === 'left' && !p.collapsed ? '50%' : 0)};
  right: ${p => (p.orientation === 'left' && !p.collapsed ? space(1) : 0)};
  width: 11px;
  height: 11px;
  transform: ${p =>
    p.orientation === 'left' && !p.collapsed ? 'translate(-50%, -50%)' : 'none'};
  border-radius: 50%;
  background-color: ${p => p.theme.red300};
`;
