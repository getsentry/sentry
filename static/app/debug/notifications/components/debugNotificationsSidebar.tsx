import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link/link';
import {notificationCategories} from 'sentry/debug/notifications/data';
import {useLocation} from 'sentry/utils/useLocation';

export function DebugNotificationsSidebar() {
  const location = useLocation();
  return (
    <SidebarContainer>
      <ul>
        {notificationCategories.map(category => (
          <li key={category.value}>
            <h3>{category.label}</h3>
            <nav>
              <StoryList>
                {category.sources.map(source => (
                  <li key={source.value}>
                    <NotificationLink
                      to={
                        location.query.source === source.value
                          ? {query: {...location.query, source: undefined}}
                          : {query: {...location.query, source: source.value}}
                      }
                      active={location.query.source === source.value}
                    >
                      {source.label}
                    </NotificationLink>
                  </li>
                ))}
              </StoryList>
            </nav>
          </li>
        ))}
      </ul>
    </SidebarContainer>
  );
}

const SidebarContainer = styled('nav')`
  position: fixed;
  top: 52px;
  grid-row: 1;
  grid-column: 1;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  min-height: 0;
  height: calc(100dvh - 52px);
  z-index: 0;
  box-shadow: 1px 0 0 0 ${p => p.theme.tokens.border.primary};
  width: 256px;
  background: ${p => p.theme.tokens.background.primary};
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: ${p => p.theme.tokens.border.primary} ${p => p.theme.background};
  ul,
  li {
    list-style: none;
  }
  > ul {
    padding-left: ${p => p.theme.space.md};
    padding-block: ${p => p.theme.space.xl};
  }
  > ul > li::before {
    display: block;
    content: '';
    height: 1px;
    background: ${p => p.theme.tokens.border.muted};
    margin: ${p => p.theme.space.xl} ${p => p.theme.space.md};
  }
  > ul > li:first-child::before {
    content: none;
  }
  h3 {
    color: ${p => p.theme.tokens.content.primary};
    font-size: ${p => p.theme.fontSize.md};
    font-weight: ${p => p.theme.fontWeight.bold};
    margin: 0;
    padding: ${p => p.theme.space.md};
  }
`;

const StoryList = styled('ul')`
  list-style-type: none;
  padding-left: 16px;

  &:first-child {
    padding-left: 0;
  }
`;

const NotificationLink = styled(Link, {
  shouldForwardProp: prop => prop !== 'active',
})<{active: boolean}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  color: ${p =>
    p.active ? p.theme.tokens.content.success : p.theme.tokens.content.muted};
  padding: ${p =>
    `${p.theme.space.md} ${p.theme.space.md} ${p.theme.space.md} ${p.theme.space.sm}`};
  position: relative;
  transition: none;

  &:before {
    background: ${p =>
      p.theme.isChonk ? (p.theme as any).colors.green100 : p.theme.green100};
    content: '';
    inset: 0 ${p => p.theme.space.md} 0 -${p => p.theme.space['2xs']};
    position: absolute;
    z-index: -1;
    border-radius: ${p => p.theme.borderRadius};
    opacity: ${p => (p.active ? 1 : 0)};
    transition: none;
  }

  &:after {
    content: '';
    position: absolute;
    left: -8px;
    height: 20px;
    background: ${p => p.theme.tokens.graphics.success};
    width: 4px;
    border-radius: ${p => p.theme.borderRadius};
    opacity: ${p => (p.active ? 1 : 0)};
    transition: none;
  }

  &:hover {
    color: ${p =>
      p.active ? p.theme.tokens.content.success : p.theme.tokens.content.primary};

    &:before {
      background: ${p => (p.active ? p.theme.green100 : p.theme.gray100)};
      opacity: 1;
    }
  }

  &:active {
    color: ${p =>
      p.active ? p.theme.tokens.content.success : p.theme.tokens.content.primary};

    &:before {
      background: ${p => (p.active ? p.theme.green200 : p.theme.gray200)};
      opacity: 1;
    }
  }
`;
