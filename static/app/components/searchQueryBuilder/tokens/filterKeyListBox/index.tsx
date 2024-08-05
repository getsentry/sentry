import {Fragment, type ReactNode} from 'react';
import styled from '@emotion/styled';
import type {AriaListBoxOptions} from '@react-aria/listbox';
import type {ComboBoxState} from '@react-stately/combobox';
import type {Key} from '@react-types/shared';

import {Button} from 'sentry/components/button';
import {ListBox} from 'sentry/components/compactSelect/listBox';
import type {
  SelectKey,
  SelectOptionOrSectionWithKey,
} from 'sentry/components/compactSelect/types';
import {Overlay} from 'sentry/components/overlay';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

type FilterKeyListBoxProps<T> = {
  hiddenOptions: Set<SelectKey>;
  isOpen: boolean;
  listBoxProps: AriaListBoxOptions<T>;
  listBoxRef: React.RefObject<HTMLUListElement>;
  popoverRef: React.RefObject<HTMLDivElement>;
  sections: Array<T>;
  selectedSection: Key | null;
  setSelectedSection: (section: Key | null) => void;
  state: ComboBoxState<T>;
};

function ListBoxSectionButton({
  onClick,
  selected,
  children,
}: {
  children: ReactNode;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <SectionButton
      size="zero"
      borderless
      aria-selected={selected}
      onClick={onClick}
      tabIndex={-1}
    >
      {children}
    </SectionButton>
  );
}

function FeedbackFooter() {
  const {searchSource} = useSearchQueryBuilder();
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
            messagePlaceholder: t('How can we make search better for you?'),
            tags: {
              search_source: searchSource,
              ['feedback.source']: 'search_query_builder',
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

export function FilterKeyListBox<T extends SelectOptionOrSectionWithKey<string>>({
  hiddenOptions,
  isOpen,
  listBoxProps,
  listBoxRef,
  popoverRef,
  state,
  sections,
  selectedSection,
  setSelectedSection,
}: FilterKeyListBoxProps<T>) {
  return (
    <SectionedOverlay ref={popoverRef}>
      {isOpen ? (
        <Fragment>
          <SectionedListBoxTabPane>
            <ListBoxSectionButton
              selected={selectedSection === null}
              onClick={() => {
                setSelectedSection(null);
                state.selectionManager.setFocusedKey(null);
              }}
            >
              {t('All')}
            </ListBoxSectionButton>
            {sections.map(section => (
              <ListBoxSectionButton
                key={section.key}
                selected={selectedSection === section.key}
                onClick={() => {
                  setSelectedSection(section.key);
                  state.selectionManager.setFocusedKey(null);
                }}
              >
                {section.label}
              </ListBoxSectionButton>
            ))}
          </SectionedListBoxTabPane>
          <SectionedListBoxPane>
            <ListBox
              {...listBoxProps}
              ref={listBoxRef}
              listState={state}
              hasSearch={false}
              hiddenOptions={hiddenOptions}
              keyDownHandler={() => true}
              overlayIsOpen={isOpen}
              showSectionHeaders={!selectedSection}
              size="sm"
            />
          </SectionedListBoxPane>
          <FeedbackFooter />
        </Fragment>
      ) : null}
    </SectionedOverlay>
  );
}

const SectionedOverlay = styled(Overlay)`
  overflow: hidden;
  display: grid;
  grid-template-columns: 120px 240px;
  grid-template-rows: 1fr auto;
  grid-template-areas:
    'left right'
    'footer footer';
  height: 400px;
  width: 360px;
`;

const SectionedOverlayFooter = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  grid-area: footer;
  padding: ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const SectionedListBoxPane = styled('div')`
  overflow-y: auto;
`;

const SectionedListBoxTabPane = styled(SectionedListBoxPane)`
  padding: ${space(1)};
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  border-right: 1px solid ${p => p.theme.innerBorder};
`;

const SectionButton = styled(Button)`
  display: block;
  height: 32px;
  width: 100%;
  text-align: left;
  font-weight: ${p => p.theme.fontWeightNormal};
  padding: 0 ${space(1)};

  span {
    justify-content: flex-start;
  }

  &[aria-selected='true'] {
    background-color: ${p => p.theme.purple100};
    color: ${p => p.theme.purple300};
    font-weight: ${p => p.theme.fontWeightBold};
  }
`;
