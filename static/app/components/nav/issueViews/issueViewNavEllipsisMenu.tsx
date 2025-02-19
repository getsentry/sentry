import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconEllipsis, IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

export function IssueViewNavEllipsisMenu({
  sectionBodyRef,
  setIsEditing,
}: {
  setIsEditing: (isEditing: boolean) => void;
  sectionBodyRef?: React.RefObject<HTMLDivElement>;
}) {
  return (
    <DropdownMenu
      position="bottom-start"
      trigger={props => (
        <TriggerWrapper {...props} data-ellipsis-menu-trigger>
          <InteractionStateLayer />
          <IconEllipsis compact color="gray500" />
          <UnsavedChangesIndicator
            role="presentation"
            data-test-id="unsaved-changes-indicator"
          />
        </TriggerWrapper>
      )}
      items={[
        {
          key: 'save-changes',
          label: t('Save Changes'),
          priority: 'primary',
          onAction: () => {},
        },
        {
          key: 'discard-changes',
          label: t('Discard Changes'),
          onAction: () => {},
        },
        {
          key: 'rename-tab',
          label: t('Rename'),
          onAction: () => setIsEditing(true),
        },
        {
          key: 'duplicate-tab',
          label: t('Duplicate'),
          onAction: () => {},
        },
        {
          key: 'delete-tab',
          label: t('Delete'),
          priority: 'danger',
          onAction: () => {},
        },
      ]}
      onInteractOutside={() => true}
      menuFooter={<FeedbackFooter />}
      usePortal
      portalContainerRef={sectionBodyRef}
    />
  );
}

function FeedbackFooter() {
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <SectionedOverlayFooter>
      <Button
        size="xs"
        icon={<IconMegaphone />}
        onClick={() =>
          openForm({
            messagePlaceholder: t('How can we make custom views better for you?'),
            tags: {
              ['feedback.source']: 'custom_views',
              ['feedback.owner']: 'issues',
            },
          })
        }
      >
        {t('Give Feedback')}
      </Button>
    </SectionedOverlayFooter>
  );
}

const TriggerWrapper = styled('div')`
  position: relative;
  width: 24px;
  height: 20px;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
  align-items: center;
  justify-content: center;
  padding: 0;
  background-color: inherit;
  opacity: inherit;
  display: none;
`;

const SectionedOverlayFooter = styled('div')`
  grid-area: footer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const UnsavedChangesIndicator = styled('div')`
  border-radius: 50%;
  background: ${p => p.theme.purple400};
  border: solid 1px ${p => p.theme.background};
  position: absolute;
  width: 7px;
  height: 7px;
  top: -3px;
  right: -3px;
  opacity: 1;
`;
