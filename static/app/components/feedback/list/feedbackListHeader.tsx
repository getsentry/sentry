import styled from '@emotion/styled';

import AlertLink from 'sentry/components/alertLink';
import Checkbox from 'sentry/components/checkbox';
import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import FeedbackListBulkSelection from 'sentry/components/feedback/list/feedbackListBulkSelection';
import MailboxPicker from 'sentry/components/feedback/list/mailboxPicker';
import type useListItemCheckboxState from 'sentry/components/feedback/list/useListItemCheckboxState';
import useFeedbackCache from 'sentry/components/feedback/useFeedbackCache';
import useFeedbackHasNewItems from 'sentry/components/feedback/useFeedbackHasNewItems';
import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import {t} from 'sentry/locale';
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

  const {listPrefetchQueryKey, resetListHeadTime} = useFeedbackQueryKeys();
  const hasNewItems = useFeedbackHasNewItems({listPrefetchQueryKey});
  const {invalidateListCache} = useFeedbackCache();

  return (
    <HeaderPanel>
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
      {hasNewItems ? (
        <AlertLink
          system
          priority="info"
          size="small"
          withoutMarginBottom
          onClick={() => {
            // Get a new date for polling:
            resetListHeadTime();
            // Clear the list cache and let people start over from the newest
            // data in the list:
            invalidateListCache();
          }}
        >
          {t('Load new feedback')}
        </AlertLink>
      ) : null}
    </HeaderPanel>
  );
}

const HeaderPanel = styled('div')`
  flex-direction: column;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const HeaderPanelItem = styled('div')`
  padding: ${space(1)} ${space(2)} ${space(1)} ${space(2)};
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;
