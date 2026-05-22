import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex} from '@sentry/scraps/layout';

import {FeedbackListBulkSelection} from 'sentry/components/feedback/list/feedbackListBulkSelection';
import {MailboxPicker} from 'sentry/components/feedback/list/mailboxPicker';
import {useFeedbackApiOptions} from 'sentry/components/feedback/useFeedbackApiOptions';
import {useFeedbackCache} from 'sentry/components/feedback/useFeedbackCache';
import {useFeedbackHasNewItems} from 'sentry/components/feedback/useFeedbackHasNewItems';
import {useMailbox} from 'sentry/components/feedback/useMailbox';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';

export function FeedbackListHeader() {
  const {
    countSelected,
    deselectAll,
    isAllSelected,
    isAnySelected,
    selectAll,
    selectedIds,
  } = useListItemCheckboxContext();
  const [mailbox, setMailbox] = useMailbox();

  const {listPrefetchApiOptions, resetListHeadTime} = useFeedbackApiOptions();
  const hasNewItems = useFeedbackHasNewItems({listPrefetchApiOptions});
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
        <Flex justify="center" align="center" flexGrow={1} padding="xs">
          <Button
            variant="primary"
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
        </Flex>
      ) : null}
    </HeaderPanel>
  );
}

const HeaderPanel = styled('div')`
  flex-direction: column;
`;

const HeaderPanelItem = styled('div')`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg} ${p => p.theme.space.md}
    ${p => p.theme.space.xl};
  display: flex;
  gap: ${p => p.theme.space.md};
  align-items: center;
  border: 1px solid transparent;
  border-bottom-color: ${p => p.theme.tokens.border.secondary};
`;
