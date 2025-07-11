import styled from '@emotion/styled';

import {notificationCategories} from 'sentry/debug/notifs/data';
import {FolderLink, StoryList} from 'sentry/stories/view/storyTree';
import {useLocation} from 'sentry/utils/useLocation';

export function NotifSidebar() {
  const location = useLocation();
  return (
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
  );
}

const NotificationLink = styled(FolderLink)`
  color: ${p =>
    p.active ? p.theme.tokens.content.success : p.theme.tokens.content.muted};
  &:before {
    background: ${p =>
      p.theme.isChonk ? (p.theme as any).colors.green100 : p.theme.green100};
  }
  &:after {
    background: ${p => p.theme.tokens.graphics.success};
  }
  &:hover {
    color: ${p =>
      p.active ? p.theme.tokens.content.success : p.theme.tokens.content.primary};
    &:before {
      background: ${p => (p.active ? p.theme.green100 : p.theme.gray100)};
    }
  }
  &:active {
    color: ${p =>
      p.active ? p.theme.tokens.content.success : p.theme.tokens.content.primary};

    &:before {
      background: ${p => (p.active ? p.theme.green200 : p.theme.gray200)};
    }
  }
`;
