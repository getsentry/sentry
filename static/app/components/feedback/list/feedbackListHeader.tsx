import styled from '@emotion/styled';

import Checkbox from 'sentry/components/checkbox';
import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import FeedbackListBulkSelection from 'sentry/components/feedback/list/feedbackListBulkSelection';
import MailboxPicker from 'sentry/components/feedback/list/mailboxPicker';
import type useListItemCheckboxState from 'sentry/components/feedback/list/useListItemCheckboxState';
import PanelItem from 'sentry/components/panels/panelItem';
import {space} from 'sentry/styles/space';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useUrlParams from 'sentry/utils/useUrlParams';

interface Props
  extends Pick<
    ReturnType<typeof useListItemCheckboxState>,
    | 'countSelected'
    | 'deselectAll'
    | 'isAllSelected'
    | 'isAnySelected'
    | 'selectAll'
    | 'selectedIds'
  > {}

export default function FeedbackListHeader({
  countSelected,
  deselectAll,
  isAllSelected,
  isAnySelected,
  selectAll,
  selectedIds,
}: Props) {
  const {mailbox} = useLocationQuery({
    fields: {
      mailbox: decodeMailbox,
    },
  });
  const {setParamValue: setMailbox} = useUrlParams('mailbox');

  return (
    <HeaderPanelItem>
      <Checkbox
        checked={isAllSelected}
        onChange={() => {
          if (isAllSelected === true) {
            deselectAll();
          } else {
            selectAll();
          }
        }}
      />
      {isAnySelected ? (
        <FeedbackListBulkSelection
          mailbox={mailbox}
          countSelected={countSelected}
          selectedIds={selectedIds}
          deselectAll={deselectAll}
        />
      ) : (
        <MailboxPicker value={mailbox} onChange={setMailbox} />
      )}
    </HeaderPanelItem>
  );
}

const HeaderPanelItem = styled(PanelItem)`
  display: flex;
  padding: ${space(1)} ${space(2)} ${space(1)} ${space(2)};
  gap: ${space(1)};
  align-items: center;
`;
