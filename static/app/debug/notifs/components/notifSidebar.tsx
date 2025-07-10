import {useState} from 'react';
import styled from '@emotion/styled';

import {notificationCategories} from 'sentry/debug/notifs/data';
import {NotificationCategory} from 'sentry/debug/notifs/types';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export function NotifSidebar() {
  return (
    <ul>
      {notificationCategories.map(category => (
        <NotificationCategory key={category.value} item={category} selection={null} />
      ))}
    </ul>
  );
}

function NotificationCategory({
  item,
  selection,
}: {
  item: NotificationCategory;
  selection: {category: NotificationCategory; source: string} | null;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  return (
    <Category key={item.value} selected={selection?.category === item}>
      <summary onClick={() => setOpen(!open)}>
        <IconChevron size="xs" />
        {item.label}
      </summary>
      <SourceContainer>
        {item.sources.map(source => (
          <NotificationSource
            key={source}
            selected={selection?.source === source}
            onClick={() => {
              if (selection?.source === source) {
                navigate(
                  {query: {...location.query, source: undefined}},
                  {replace: true}
                );
              } else {
                navigate({query: {...location.query, source}}, {replace: true});
              }
            }}
          >
            {source}
          </NotificationSource>
        ))}
      </SourceContainer>
    </Category>
  );
}

const Category = styled('li')<{selected: boolean}>`
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => (p.selected ? p.theme.green100 : 'transparent')};
  padding: ${space(1)};
  summary {
    margin-left: ${space(1)};
    cursor: pointer;
    user-select: none;
    font-weight: bold;
    svg {
      transition: transform 0.2s ease;
      margin-right: ${space(0.5)};
      transform: rotate(90deg);
    }
  }
  &[open] summary svg {
    transform: rotate(180deg);
  }
`;

const SourceContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  margin-left: 24px;
`;

const NotificationSource = styled('button')<{selected: boolean}>`
  outline: none;
  border: none;
  background: transparent;
  text-align: left;
  text-decoration: ${p => (p.selected ? 'underline' : 'none')};
  text-decoration-color: ${p => p.theme.green400};
  text-decoration-thickness: 1px;
`;
