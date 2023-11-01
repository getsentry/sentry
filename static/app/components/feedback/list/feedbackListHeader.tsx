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
import useListItemCheckboxState from 'sentry/components/feedback/list/useListItemCheckboxState';
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
    'checkAll' | 'state' | 'uncheckAll'
  > {}

function checkboxStateToChecked(
  state: ReturnType<typeof useListItemCheckboxState>['state']
) {
  if ('all' in state) {
    return true;
  }

  if (state.ids.size === 0) {
    return false;
  }
  if (state.ids.size === state.total) {
    return true;
  }
  return 'indeterminate';
}

export default function FeedbackListHeader({checkAll, state, uncheckAll}: Props) {
  const {mailbox} = useLocationQuery({
    fields: {
      mailbox: decodeMailbox,
    },
  });
  const {setParamValue: setMailbox} = useUrlParams('mailbox');

  const checked = checkboxStateToChecked(state);
  return (
    <HeaderPanelItem>
      <Checkbox
        checked={checked}
        onChange={() => {
          if (checked === true) {
            uncheckAll();
          } else {
            checkAll();
          }
        }}
      />
      {'all' in state || state.ids.size ? (
        <HasSelection mailbox={mailbox} state={state} uncheckAll={uncheckAll} />
      ) : (
        <MailboxPicker value={mailbox} onChange={setMailbox} />
      )}
    </HeaderPanelItem>
  );
}

interface SelectionProps
  extends Pick<ReturnType<typeof useListItemCheckboxState>, 'state' | 'uncheckAll'> {
  mailbox: ReturnType<typeof decodeMailbox>;
}

function HasSelection({mailbox, state, uncheckAll}: SelectionProps) {
  const organization = useOrganization();
  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: 'all' in state ? 'all' : Array.from(state.ids),
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
          {tct('[count] Selected', {
            count: 'all' in state ? state.total : state.ids.size,
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
              uncheckAll();
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
