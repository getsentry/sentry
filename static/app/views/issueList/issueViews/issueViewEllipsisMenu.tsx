import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis, IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

interface IssueViewEllipsisMenuProps {
  menuOptions: MenuItemProps[];
  'aria-label'?: string;
  hasUnsavedChanges?: boolean;
}

export function IssueViewEllipsisMenu({
  hasUnsavedChanges = false,
  menuOptions,
  ...props
}: IssueViewEllipsisMenuProps) {
  return (
    <TriggerIconWrap>
      <StyledDropdownMenu
        position="bottom-start"
        triggerProps={{
          'aria-label': props['aria-label'] ?? 'Tab Options',
          size: 'zero',
          showChevron: false,
          borderless: true,
          icon: (
            <ButtonWrapper>
              <IconEllipsis compact />
              {hasUnsavedChanges && (
                <UnsavedChangesIndicator
                  role="presentation"
                  data-test-id="unsaved-changes-indicator"
                />
              )}
            </ButtonWrapper>
          ),
          style: {width: '18px', height: '16px', borderRadius: '4px'},
        }}
        items={menuOptions}
        offset={[-10, 5]}
        menuFooter={<FeedbackFooter />}
        usePortal
      />
    </TriggerIconWrap>
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

const SectionedOverlayFooter = styled('div')`
  grid-area: footer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const StyledDropdownMenu = styled(DropdownMenu)`
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const UnsavedChangesIndicator = styled('div')`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${p => p.theme.active};
  border: solid 1px ${p => p.theme.background};
  position: absolute;
  top: -3px;
  right: -3px;
`;
const ButtonWrapper = styled('div')`
  width: 18px;
  height: 16px;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: 4px;
`;

const TriggerIconWrap = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;
