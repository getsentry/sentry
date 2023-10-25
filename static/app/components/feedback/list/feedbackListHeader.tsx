import styled from '@emotion/styled';

import Checkbox from 'sentry/components/checkbox';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import MailboxPicker from 'sentry/components/feedback/list/mailboxPicker';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useUrlParams from 'sentry/utils/useUrlParams';

interface Props {
  checked: string[];
  toggleChecked: (id: string) => void;
}

export default function FeedbackListHeader({checked, toggleChecked}: Props) {
  const {mailbox} = useLocationQuery({
    fields: {
      mailbox: decodeMailbox,
    },
  });
  const {setParamValue: setMailbox} = useUrlParams('mailbox');

  return (
    <HeaderPanelItem>
      <Checkbox
        checked={checked.length ? 'indeterminate' : false}
        onChange={() => {
          checked.length ? checked.forEach(c => toggleChecked(c)) : null;
        }}
      />
      {checked.length ? (
        <HasSelection checked={checked} />
      ) : (
        <MailboxPicker value={mailbox} onChange={setMailbox} />
      )}
    </HeaderPanelItem>
  );
}

function HasSelection({checked}) {
  return (
    <Flex gap={space(1)} align="center" justify="space-between" style={{flexGrow: 1}}>
      <span>
        <strong>{tct('[count] Selected', {count: checked.length})}</strong>
      </span>
      <Flex gap={space(1)} justify="flex-end">
        <ErrorBoundary mini>
          <DropdownMenu
            position="bottom-end"
            triggerLabel="Unresolved"
            triggerProps={{
              'aria-label': t('Resolve or Archive Menu'),
              showChevron: true,
              size: 'xs',
            }}
            items={[
              {
                key: 'resolve',
                label: t('Resolve'),
                onAction: () => {},
              },
              {
                key: 'archive',
                label: t('Archive'),
                onAction: () => {},
              },
            ]}
          />
        </ErrorBoundary>
        <ErrorBoundary mini>
          <DropdownMenu
            position="bottom-end"
            triggerProps={{
              'aria-label': t('Read Menu'),
              icon: <IconEllipsis size="xs" />,
              showChevron: false,
              size: 'xs',
            }}
            items={[
              {
                key: 'mark read',
                label: t('Mark as read'),
                onAction: () => {},
              },
              {
                key: 'mark unread',
                label: t('Mark as unread'),
                onAction: () => {},
              },
            ]}
          />
        </ErrorBoundary>
      </Flex>
    </Flex>
  );
}

const HeaderPanelItem = styled(PanelItem)`
  display: flex;
  padding: ${space(1)} ${space(2)} ${space(1)} ${space(2)};
  gap: ${space(1)};
  align-items: center;
`;
