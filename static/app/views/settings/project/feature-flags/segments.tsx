import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import NewBooleanField from 'sentry/components/forms/booleanField';
import NotAvailable from 'sentry/components/notAvailable';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import {IconDelete, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {FeatureFlagSegment} from 'sentry/types/featureFlags';
import {defined} from 'sentry/utils';

import {
  DraggableRuleList,
  DraggableRuleListUpdateItemsProps,
} from '../server-side-sampling/draggableRuleList';
import {rateToPercentage} from '../server-side-sampling/utils';

type Props = {
  hasAccess: boolean;
  onDeleteSegment: (index: number) => void;
  onEditSegment: (index: number) => void;
  onSort: (props: DraggableRuleListUpdateItemsProps) => void;
  onToggleBooleanSegment: (index: number) => void;
  segments: FeatureFlagSegment[];
  showGrab?: boolean;
};

export function Segments({
  onDeleteSegment,
  onEditSegment,
  onToggleBooleanSegment,
  hasAccess,
  onSort,
  segments,
  showGrab,
}: Props) {
  const items = segments.map(segment => ({
    ...segment,
    id: String(segment.id),
  })) as any[];

  return (
    <Wrapper>
      <SegmentsPanelHeader>
        <SegmentsLayout>
          <Column />
          <TypeColumn>{t('Type')}</TypeColumn>
          <TagsColumn>{t('Tags')}</TagsColumn>
          <ResultColumn>{t('Result')}</ResultColumn>
          <RolloutColumn>{t('Rollout')}</RolloutColumn>
          <ActionsColumn />
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

            const segment = items[index];

            return (
              <SegmentsLayout isContent onClick={() => onEditSegment(index)}>
                <GrabColumn disabled={!hasAccess}>
                  {showGrab && (
                    <IconGrabbableWrapper
                      {...listeners}
                      {...attributes}
                      aria-label={dragging ? t('Drop Segment') : t('Drag Segment')}
                      aria-disabled={!hasAccess}
                    >
                      <IconGrabbable />
                    </IconGrabbableWrapper>
                  )}
                </GrabColumn>
                <TypeColumn>
                  <Type>{segment.type === 'match' ? t('Match') : t('Rollout')}</Type>
                </TypeColumn>
                <TagsColumn>
                  {!!segment.tags ? (
                    <Tags>
                      {Object.keys(segment.tags).map(tag => (
                        <Tag key={tag} name={tag} value={segment.tags?.[tag]} />
                      ))}
                    </Tags>
                  ) : (
                    <NotAvailable />
                  )}
                </TagsColumn>
                <ResultColumn>
                  {typeof segment.result === 'boolean' ? (
                    <ActiveToggle
                      inline={false}
                      hideControlState
                      name="active"
                      value={segment.result}
                      onClick={e => {
                        e.stopPropagation();
                        e.preventDefault();
                        onToggleBooleanSegment(index);
                      }}
                    />
                  ) : (
                    String(segment.result)
                  )}
                </ResultColumn>
                <RolloutColumn>
                  {segment.type === 'rollout' && defined(segment.percentage)
                    ? `${rateToPercentage(segment.percentage)}%`
                    : `100%`}
                </RolloutColumn>
                <ActionsColumn>
                  <Button
                    aria-label={t('Delete Segment')}
                    size="xs"
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();
                      openConfirmModal({
                        message: t('Are you sure you want to delete this segment?'),
                        priority: 'danger',
                        onConfirm: () => onDeleteSegment(index),
                      });
                    }}
                    icon={<IconDelete size="sm" />}
                  />
                </ActionsColumn>
              </SegmentsLayout>
            );
          }}
        />
      </PanelBody>
    </Wrapper>
  );
}

const SegmentsPanelHeader = styled(PanelHeader)`
  padding: ${space(0.5)} 0;
`;

const SegmentsLayout = styled('div')<{isContent?: boolean}>`
  width: 100%;
  display: grid;
  grid-template-columns: 90px 1fr 66px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 48px 90px 1fr 0.5fr 96px 66px;
  }

  ${p =>
    p.isContent &&
    css`
      > * {
        line-height: 28px;
        border-bottom: 1px solid ${p.theme.border};
        ${p.isContent &&
        css`
          cursor: pointer;
        `};
      }

      :hover {
        > * {
          background-color: ${p.theme.backgroundSecondary};
        }
      }
    `}
`;

const Column = styled('div')`
  display: flex;
  padding: ${space(1)} ${space(2)};
  white-space: pre-wrap;
  word-break: break-all;
`;

export const GrabColumn = styled(Column)<{disabled?: boolean}>`
  [role='button'] {
    cursor: grab;
  }

  ${p =>
    p.disabled &&
    css`
      [role='button'] {
        cursor: not-allowed;
      }
      color: ${p.theme.disabled};
    `}

  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
  }
`;

const TypeColumn = styled(Column)`
  text-align: left;
`;

const TagsColumn = styled(Column)`
  align-items: center;
`;

const RolloutColumn = styled(Column)`
  text-align: center;
  justify-content: center;
`;

const ActionsColumn = styled(Column)`
  justify-content: flex-end;
`;

const ResultColumn = styled(Column)`
  text-align: right;
  justify-content: flex-end;
`;

const Type = styled('div')`
  color: ${p => p.theme.active};
`;

const Wrapper = styled(Panel)`
  border: none;
  margin-bottom: 0;
`;

const IconGrabbableWrapper = styled('div')`
  outline: none;
  display: flex;
  align-items: center;
  height: 28px;
`;

const Tags = styled(Pills)`
  display: flex;
  gap: ${space(1)};
`;

const Tag = styled(Pill)`
  margin-bottom: 0;
`;

const ActiveToggle = styled(NewBooleanField)`
  padding: 0;
  height: 28px;
  justify-content: center;
  border-bottom: none;
`;
