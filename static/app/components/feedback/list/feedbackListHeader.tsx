import {Fragment, ReactNode} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
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

function openConfirmModal({
  onConfirm,
  body,
  footerConfirm,
}: {
  body: ReactNode;
  footerConfirm: ReactNode;
  onConfirm: () => void | Promise<void>;
}) {
  openModal(({Body, Footer, closeModal}: ModalRenderProps) => (
    <Fragment>
      <Body>{body}</Body>
      <Footer>
        <Flex gap={space(1)}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="primary"
            onClick={() => {
              closeModal();
              addLoadingMessage(t('Updating feedback...'));
              onConfirm();
            }}
          >
            {footerConfirm}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  ));
}

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

const statusToText: Record<string, string> = {
  resolved: 'Resolve',
  unresolved: 'Unresolve',
};

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

  const mutationOptionsResolve = {
    onError: () => {
      addErrorMessage(t('An error occurred while updating the feedback.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Updated feedback'));
      deselectAll();
    },
  };

  const mutationOptionsRead = {
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
              const newStatus =
                mailbox === 'resolved' ? GroupStatus.UNRESOLVED : GroupStatus.RESOLVED;
              openConfirmModal({
                onConfirm: () => {
                  resolve(newStatus, mutationOptionsResolve);
                },
                body: tct('Are you sure you want to [status] these feedbacks?', {
                  status: statusToText[newStatus].toLowerCase(),
                }),
                footerConfirm: statusToText[newStatus],
              });
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
                  openConfirmModal({
                    onConfirm: () => markAsRead(true, mutationOptionsRead),
                    body: t('Are you sure you want to mark these feedbacks as read?'),
                    footerConfirm: 'Mark read',
                  });
                },
              },
              {
                key: 'mark unread',
                label: t('Mark Unread'),
                onAction: () => {
                  openConfirmModal({
                    onConfirm: () => markAsRead(false, mutationOptionsRead),
                    body: t('Are you sure you want to mark these feedbacks as unread?'),
                    footerConfirm: 'Mark unread',
                  });
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
