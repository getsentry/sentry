import {useState} from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import ContextData from 'sentry/components/contextData';
import NewBooleanField from 'sentry/components/forms/booleanField';
import NotAvailable from 'sentry/components/notAvailable';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import {IconChevron, IconDelete, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {FeatureFlagKind, FeatureFlagSegment} from 'sentry/types/featureFlags';
import {defined} from 'sentry/utils';

import {rateToPercentage} from '../server-side-sampling/utils';

import {getCustomTagLabel, isCustomTag} from './utils';

type Props = {
  dragging: boolean;
  flagKind: FeatureFlagKind;
  hasAccess: boolean;
  listeners: DraggableSyntheticListeners;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
  segment: FeatureFlagSegment;
  grabAttributes?: UseDraggableArguments['attributes'];
  showGrab?: boolean;
};

export function Segment({
  onDelete,
  onToggle,
  onEdit,
  hasAccess,
  segment,
  showGrab,
  flagKind,
  listeners,
  grabAttributes,
  dragging,
}: Props) {
  const [expandedPayload, setExpandedPayload] = useState(false);

  return (
    <SegmentsLayout isContent onClick={onEdit}>
      <ActionsColumn>
        {showGrab && (
          <Grabber disabled={!hasAccess}>
            <IconGrabbableWrapper
              {...listeners}
              {...grabAttributes}
              aria-label={dragging ? t('Drop Segment') : t('Drag Segment')}
              aria-disabled={!hasAccess}
            >
              <IconGrabbable />
            </IconGrabbableWrapper>
          </Grabber>
        )}
        <Button
          aria-label={t('See payload')}
          size="xs"
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            setExpandedPayload(!expandedPayload);
          }}
          borderless
          disabled={!segment.payload}
          title={segment.payload ? undefined : t('No payload available')}
          icon={<IconChevron direction={expandedPayload ? 'up' : 'down'} />}
        />
      </ActionsColumn>
      <TypeColumn>
        <Type>{segment.type === 'match' ? t('Match') : t('Rollout')}</Type>
      </TypeColumn>
      <TagsColumn>
        {!!segment.tags ? (
          <Tags>
            {Object.keys(segment.tags).map(tag => {
              const tagValue = segment.tags?.[tag];
              return (
                <Tag
                  key={tag}
                  name={isCustomTag(tag) ? getCustomTagLabel(tag) : tag}
                  value={Array.isArray(tagValue) ? tagValue.join(', ') : tagValue}
                />
              );
            })}
          </Tags>
        ) : (
          <NotAvailable />
        )}
      </TagsColumn>
      <ResultColumn>
        {flagKind === FeatureFlagKind.BOOLEAN ? (
          <ActiveToggle
            inline={false}
            hideControlState
            name="active"
            value={segment.result}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              onToggle();
            }}
          />
        ) : flagKind === FeatureFlagKind.RATE && typeof segment.result === 'number' ? (
          `${rateToPercentage(segment.result)}%`
        ) : (
          segment.result
        )}
      </ResultColumn>
      <RolloutColumn>
        {segment.type === 'rollout' && defined(segment.percentage)
          ? `${rateToPercentage(segment.percentage)}%`
          : `100%`}
      </RolloutColumn>
      <DeleteColumn>
        <Button
          aria-label={t('Delete Segment')}
          size="xs"
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            openConfirmModal({
              message: t('Are you sure you want to delete this segment?'),
              priority: 'danger',
              onConfirm: () => onDelete(),
            });
          }}
          icon={<IconDelete size="sm" />}
        />
      </DeleteColumn>
      {segment.payload && expandedPayload && (
        <Payload
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <StyledContextData data={JSON.parse(segment.payload)} />
        </Payload>
      )}
    </SegmentsLayout>
  );
}

export const SegmentsLayout = styled('div')<{isContent?: boolean}>`
  width: 100%;
  display: grid;
  grid-template-columns: 74px 1fr 108px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 74px 90px 1fr 0.5fr 96px 66px;
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

export const Column = styled('div')`
  display: flex;
  padding: ${space(1)} ${space(2)};
  white-space: pre-wrap;
  word-break: break-all;
`;

export const ActionsColumn = styled(Column)`
  display: grid;
  grid-template-columns: max-content max-content;
  gap: ${space(1)};
`;

export const TypeColumn = styled(Column)`
  text-align: left;
`;

export const TagsColumn = styled(Column)`
  align-items: center;
`;

export const RolloutColumn = styled(Column)`
  text-align: center;
  justify-content: center;
`;

export const DeleteColumn = styled(Column)``;

export const ResultColumn = styled(Column)`
  text-align: right;
  justify-content: flex-end;
`;

const Payload = styled(Column)`
  grid-column: 1/-1;
  grid-row: 2/2;
  cursor: default;
`;

const Type = styled('div')`
  color: ${p => p.theme.active};
`;

const Grabber = styled('div')<{disabled?: boolean}>`
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

const StyledContextData = styled(ContextData)`
  width: 100%;
`;
