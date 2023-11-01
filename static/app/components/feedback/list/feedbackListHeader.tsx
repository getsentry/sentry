import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Button from 'sentry/components/actions/button';
import Checkbox from 'sentry/components/checkbox';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import MailboxPicker from 'sentry/components/feedback/list/mailboxPicker';
import type useListItemCheckboxState from 'sentry/components/feedback/list/useListItemCheckboxState';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {GroupStatus} from 'sentry/types';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
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
        <HasSelection
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

interface HasSelectionProps
  extends Pick<
    ReturnType<typeof useListItemCheckboxState>,
    'countSelected' | 'selectedIds' | 'deselectAll'
  > {
  mailbox: ReturnType<typeof decodeMailbox>;
}

function HasSelection({
  mailbox,
  countSelected,
  selectedIds,
  deselectAll,
}: HasSelectionProps) {
  const organization = useOrganization();
  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: selectedIds,
    organization,
  });

  const mutationOptions = {
    onError: () => {
      addErrorMessage(t('An error occurred while updating the feedback.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Updated feedback'));
    },
  };

  return (
    <Flex gap={space(1)} align="center" justify="space-between" style={{flexGrow: 1}}>
      <span>
        <strong>
          {tct('[countSelected] Selected', {
            countSelected,
          })}
        </strong>
      </span>
      <Flex gap={space(1)} justify="flex-end">
        <ErrorBoundary mini>
          <Button
            onClick={() => {
              addLoadingMessage(t('Updating feedback...'));
              const newStatus =
                mailbox === 'resolved' ? GroupStatus.UNRESOLVED : GroupStatus.RESOLVED;
              resolve(newStatus, mutationOptions);
              deselectAll();
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
                onAction: () => {
                  addLoadingMessage(t('Updating feedback...'));
                  markAsRead(true, mutationOptions);
                },
              },
              {
                key: 'mark unread',
                label: t('Mark Unread'),
                onAction: () => {
                  addLoadingMessage(t('Updating feedback...'));
                  markAsRead(false, mutationOptions);
                },
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
