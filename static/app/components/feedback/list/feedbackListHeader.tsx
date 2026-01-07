import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import FeedbackListBulkSelection from 'sentry/components/feedback/list/feedbackListBulkSelection';
import MailboxPicker from 'sentry/components/feedback/list/mailboxPicker';
import useFeedbackCache from 'sentry/components/feedback/useFeedbackCache';
import useFeedbackHasNewItems from 'sentry/components/feedback/useFeedbackHasNewItems';
import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import {useMailbox} from 'sentry/components/feedback/useMailbox';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';

interface Props
  extends Pick<
    ReturnType<typeof useListItemCheckboxContext>,
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
  const [mailbox, setMailbox] = useMailbox();

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
        <RefreshContainer>
          <Button
            priority="primary"
            size="xs"
            icon={<IconRefresh />}
            onClick={() => {
              // Get a new date for polling:
              resetListHeadTime();
              // Clear the list cache and let people start over from the newest
              // data in the list:
              invalidateListCache();
            }}
          >
            {t('Load new feedback')}
          </Button>
        </RefreshContainer>
      ) : null}
    </HeaderPanel>
  );
}

const HeaderPanel = styled('div')`
  flex-direction: column;
`;

const HeaderPanelItem = styled('div')`
  padding: ${space(1)} ${space(1.5)} ${space(1)} ${space(2)};
  display: flex;
  gap: ${space(1)};
  align-items: center;
  border: 1px solid transparent;
  border-bottom-color: ${p => p.theme.tokens.border.secondary};
`;

const RefreshContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: ${space(0.5)};
`;
