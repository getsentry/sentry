import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import FeedbackListBulkSelection from 'sentry/components/feedback/list/feedbackListBulkSelection';
import MailboxPicker from 'sentry/components/feedback/list/mailboxPicker';
import type useListItemCheckboxState from 'sentry/components/feedback/list/useListItemCheckboxState';
import useFeedbackCache from 'sentry/components/feedback/useFeedbackCache';
import useFeedbackHasNewItems from 'sentry/components/feedback/useFeedbackHasNewItems';
import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import {IconRefresh} from 'sentry/icons';
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
  padding: ${space(1)} ${space(1.5)} ${space(1)} 18px;
  display: flex;
  gap: ${space(1)};
  align-items: center;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const RefreshContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: ${space(0.5)};
`;
