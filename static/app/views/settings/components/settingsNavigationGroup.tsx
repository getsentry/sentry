import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useParams} from 'sentry/utils/useParams';
import {Collapsible} from 'sentry/views/nav/collapsible';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import SettingsNavItem from 'sentry/views/settings/components/settingsNavItem';
import type {
  NavigationGroupProps,
  NavigationItem,
  NavigationSubSection,
} from 'sentry/views/settings/types';

function useNavLinks(items: NavigationItem[], props: NavigationGroupProps) {
  const {organization, project} = props;
  const params = useParams();

  return items.map(({path, title, index, show, badge, id, recordAnalytics}) => {
    if (typeof show === 'function' && !show(props)) {
      return null;
    }
    if (typeof show !== 'undefined' && !show) {
      return null;
    }
    const badgeResult = typeof badge === 'function' ? badge(props) : null;
    const to = replaceRouterParams(path, {...params, orgId: organization?.slug});

    const handleClick = () => {
      // only call the analytics event if the URL is changing
      if (recordAnalytics && to !== window.location.pathname && organization) {
        trackAnalytics('sidebar.item_clicked', {
          organization,
          project_id: project?.id,
          sidebar_item_id: id,
          dest: path,
        });
      }
    };

    return (
      <SettingsNavItem
        key={title}
        to={to}
        label={title}
        index={index}
        badge={badgeResult}
        id={id}
        onClick={handleClick}
      />
    );
  });
}

function SubSectionContent({
  subsection,
  props,
}: {
  props: NavigationGroupProps;
  subsection: NavigationSubSection;
}) {
  const {icon: SubIcon, name: subName} = subsection;
  const navLinks = useNavLinks(subsection.items, props);
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(
    `secondary-nav-section-${subsection.id}-collapsed`,
    false
  );

  if (!navLinks.some(link => link !== null)) {
    return null;
  }

  return (
    <SubSectionGroup>
      <SubSectionTitle onClick={() => setIsCollapsed(!isCollapsed)}>
        <SubSectionTitleLabel>
          {SubIcon ? (
            <Flex align="center" gap="sm">
              <SubIcon size="sm" />
              {subName}
            </Flex>
          ) : (
            <NoIconTitle>{subName}</NoIconTitle>
          )}
        </SubSectionTitleLabel>
        <IconChevron direction={isCollapsed ? 'down' : 'up'} size="xs" variant="muted" />
      </SubSectionTitle>
      <Collapsible collapsed={isCollapsed} disabled={false}>
        {navLinks}
      </Collapsible>
    </SubSectionGroup>
  );
}

function SectionIcon(props: NavigationGroupProps) {
  const {icon: Icon, renderIcon} = props;
  if (renderIcon) {
    return renderIcon(props);
  }
  if (Icon) {
    return <Icon size="sm" />;
  }
  return null;
}

function SettingsNavigationGroup(props: NavigationGroupProps) {
  const {name, items, subsections} = props;
  const navLinks = useNavLinks(items, props);

  const hasVisibleNavLinks = navLinks.some(link => link !== null);
  const hasSubsections = subsections && subsections.length > 0;

  if (!hasVisibleNavLinks && !hasSubsections) {
    return null;
  }

  const iconElement = <SectionIcon {...props} />;
  const hasIcon = props.icon || props.renderIcon;

  const title = hasIcon ? (
    <Flex align="center" gap="sm">
      {iconElement}
      {name}
    </Flex>
  ) : (
    <NoIconTitle>{name}</NoIconTitle>
  );

  return (
    <StyledSection id={props.id} title={title}>
      {navLinks}
      {subsections?.map(subsection => (
        <SubSectionContent key={subsection.id} subsection={subsection} props={props} />
      ))}
    </StyledSection>
  );
}

// Adds padding-left to nav items so they align with the title text
// (which is offset by 16px icon + 8px gap from the section edge)
const StyledSection = styled(SecondaryNav.Section)`
  a {
    padding-left: calc(${space(1.5)} + 16px + ${space(0.5)});
  }
`;

const SubSectionGroup = styled('div')`
  margin-top: ${space(0.5)};

  && a {
    padding-left: calc(${space(1.5)} + 2 * 16px + ${space(1)} + ${space(0.5)});
  }
`;

const SubSectionTitle = styled('button')`
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  cursor: pointer;
  border-radius: ${p => p.theme.radius.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.primary};
  padding: ${space(0.75)} ${space(1)} ${space(0.75)}
    calc(${space(1.5)} + 16px + ${space(1)});

  &:hover {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
`;

const SubSectionTitleLabel = styled('span')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// Aligns section titles without icons to match those with icons (16px icon + 8px gap)
const NoIconTitle = styled('span')`
  padding-left: calc(16px + ${space(1)});
`;

export default SettingsNavigationGroup;
