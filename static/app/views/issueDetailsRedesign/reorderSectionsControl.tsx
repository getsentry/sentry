import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {restrictToParentElement, restrictToVerticalAxis} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {IconGrabbable, IconHide, IconShow, IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOverlay} from 'sentry/utils/useOverlay';
import {
  useTelemetrySectionPrefs,
  type TelemetrySection,
} from 'sentry/views/issueDetailsRedesign/telemetrySections';

function SortableRow({
  section,
  hidden,
  onToggle,
}: {
  hidden: boolean;
  onToggle: (key: string) => void;
  section: TelemetrySection;
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id: section.key});

  return (
    <Row
      ref={setNodeRef}
      style={{transform: CSS.Translate.toString(transform), transition}}
      isDragging={isDragging}
    >
      <DragHandle {...attributes} {...listeners} aria-label={t('Reorder section')}>
        <IconGrabbable size="sm" />
      </DragHandle>
      <Label isHidden={hidden}>{section.label}</Label>
      <ToggleButton
        variant="transparent"
        size="zero"
        onClick={() => onToggle(section.key)}
        aria-label={hidden ? t('Show %s', section.label) : t('Hide %s', section.label)}
      >
        {hidden ? <IconHide size="sm" /> : <IconShow size="sm" />}
      </ToggleButton>
    </Row>
  );
}

/**
 * The "Reorder sections" control: a sliders button that opens a popover letting
 * users drag to reorder telemetry sections and toggle each one's visibility.
 * State is persisted via `useTelemetrySectionPrefs` and applied to the content
 * by `useTelemetrySectionStyles`.
 */
export function ReorderSectionsControl() {
  const theme = useTheme();
  const {orderedSections, hiddenKeys, setOrder, toggleHidden} =
    useTelemetrySectionPrefs();
  const {isOpen, triggerProps, overlayProps} = useOverlay({
    position: 'bottom-end',
    isKeyboardDismissDisabled: false,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 5}})
  );

  const ids = orderedSections.map(section => section.key);

  return (
    <div>
      <Button
        {...triggerProps}
        size="sm"
        icon={<IconSliders />}
        aria-label={t('Reorder sections')}
        tooltipProps={{title: t('Show, hide, or reorder sections')}}
      >
        {t('Reorder')}
      </Button>
      {isOpen && (
        <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
          <StyledOverlay>
            <Header>{t('Reorder sections')}</Header>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={({active, over}) => {
                if (over && active.id !== over.id) {
                  const oldIndex = ids.indexOf(active.id as string);
                  const newIndex = ids.indexOf(over.id as string);
                  if (oldIndex !== -1 && newIndex !== -1) {
                    setOrder(arrayMove(ids, oldIndex, newIndex));
                  }
                }
              }}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <List>
                  {orderedSections.map(section => (
                    <SortableRow
                      key={section.key}
                      section={section}
                      hidden={hiddenKeys.has(section.key)}
                      onToggle={toggleHidden}
                    />
                  ))}
                </List>
              </SortableContext>
            </DndContext>
          </StyledOverlay>
        </PositionWrapper>
      )}
    </div>
  );
}

const StyledOverlay = styled(Overlay)`
  display: flex;
  flex-direction: column;
  min-width: 260px;
  padding: ${p => p.theme.space.xs} 0;
`;

const Header = styled('div')`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  font-size: ${p => p.theme.font.size.lg};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  margin-bottom: ${p => p.theme.space.xs};
`;

const List = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Row = styled('div')<{isDragging: boolean}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  background: ${p =>
    p.isDragging ? p.theme.tokens.background.secondary : 'transparent'};
  z-index: ${p => (p.isDragging ? 1 : 'auto')};

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const DragHandle = styled('button')`
  display: flex;
  align-items: center;
  border: none;
  background: transparent;
  padding: 0;
  cursor: grab;
  color: ${p => p.theme.tokens.content.secondary};

  &:active {
    cursor: grabbing;
  }
`;

const Label = styled('div')<{isHidden: boolean}>`
  flex: 1;
  font-size: ${p => p.theme.font.size.lg};
  color: ${p =>
    p.isHidden ? p.theme.tokens.content.secondary : p.theme.tokens.content.primary};
`;

const ToggleButton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};
`;
