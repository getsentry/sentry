import styled from '@emotion/styled';

import Button from 'sentry/components/actions/button';
import Checkbox from 'sentry/components/checkbox';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import MailboxPicker from 'sentry/components/feedback/list/mailboxPicker';
import useBulkMutateFeedback from 'sentry/components/feedback/useBulkMutateFeedback';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {GroupStatus} from 'sentry/types';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
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
        <HasSelection checked={checked} mailbox={mailbox} toggleChecked={toggleChecked} />
      ) : (
        <MailboxPicker value={mailbox} onChange={setMailbox} />
      )}
    </HeaderPanelItem>
  );
}

function HasSelection({checked, mailbox, toggleChecked}) {
  const organization = useOrganization();
  const {markAsRead, resolve} = useBulkMutateFeedback({
    feedbackList: checked,
    organization,
  });

  return (
    <Flex gap={space(1)} align="center" justify="space-between" style={{flexGrow: 1}}>
      <span>
        <strong>{tct('[count] Selected', {count: checked.length})}</strong>
      </span>
      <Flex gap={space(1)} justify="flex-end">
        <ErrorBoundary mini>
          <Button
            onClick={() => {
              mailbox === 'resolved'
                ? resolve(GroupStatus.UNRESOLVED)
                : resolve(GroupStatus.RESOLVED);
              checked.forEach(c => toggleChecked(c));
            }}
          >
            {mailbox === 'resolved' ? t('Unresolve') : t('Resolve')}
          </Button>
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
                label: t('Mark Read'),
                onAction: () => markAsRead(true),
              },
              {
                key: 'mark unread',
                label: t('Mark Unread'),
                onAction: () => markAsRead(false),
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
