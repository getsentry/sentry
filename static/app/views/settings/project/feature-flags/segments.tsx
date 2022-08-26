import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {FeatureFlagKind, FeatureFlagSegment} from 'sentry/types/featureFlags';

import {
  DraggableRuleList,
  DraggableRuleListUpdateItemsProps,
} from '../server-side-sampling/draggableRuleList';

import {
  ActionsColumn,
  ConditionColumn,
  DeleteColumn,
  ResultColumn,
  RolloutColumn,
  Segment,
  SegmentsLayout,
  TypeColumn,
} from './segment';

type Props = {
  canGrab: boolean;
  flagKind: FeatureFlagKind;
  hasAccess: boolean;
  onDelete: (index: number) => void;
  onEdit: (index: number) => void;
  onSort: (props: DraggableRuleListUpdateItemsProps) => void;
  onToggle: (index: number) => void;
  segments: FeatureFlagSegment[];
};

export function Segments({
  onDelete,
  onEdit,
  onToggle,
  hasAccess,
  onSort,
  segments,
  canGrab,
  flagKind,
}: Props) {
  const items = segments.map(segment => ({
    ...segment,
    id: String(segment.id),
  })) as any[];

  return (
    <SegmentsPanel>
      <SegmentsPanelHeader>
        <SegmentsLayout>
          <ActionsColumn />
          <TypeColumn>{t('Type')}</TypeColumn>
          <ConditionColumn>{t('Condition')}</ConditionColumn>
          <ResultColumn>{t('Result')}</ResultColumn>
          <RolloutColumn>{t('Rollout')}</RolloutColumn>
          <DeleteColumn />
        </SegmentsLayout>
      </SegmentsPanelHeader>
      <PanelBody>
        <DraggableRuleList
          disabled={!hasAccess}
          items={items}
          onUpdateItems={onSort}
          wrapperStyle={({isDragging, isSorting, index}) => {
            if (isDragging) {
              return {
                cursor: 'grabbing',
              };
            }
            if (isSorting) {
              return {};
            }
            return {
              transform: 'none',
              transformOrigin: '0',
              '--box-shadow': 'none',
              '--box-shadow-picked-up': 'none',
              overflow: 'visible',
              position: 'relative',
              zIndex: segments.length - index,
              cursor: 'default',
            };
          }}
          renderItem={({value, listeners, attributes, dragging}) => {
            const index = items.findIndex(item => item.id === value);

            if (index === -1) {
              return null;
            }

            return (
              <Segment
                segment={items[index]}
                listeners={listeners}
                dragging={dragging}
                grabAttributes={attributes}
                onDelete={() => onDelete(index)}
                onEdit={() => onEdit(index)}
                onToggle={() => onToggle(index)}
                hasAccess={hasAccess}
                canGrab={canGrab}
                flagKind={flagKind}
              />
            );
          }}
        />
      </PanelBody>
    </SegmentsPanel>
  );
}

const SegmentsPanel = styled(Panel)`
  border: none;
  margin-bottom: 0;
`;

const SegmentsPanelHeader = styled(PanelHeader)`
  padding: ${space(0.5)} 0;
`;
