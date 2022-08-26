import {Fragment, useState} from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import ContextData from 'sentry/components/contextData';
import NewBooleanField from 'sentry/components/forms/booleanField';
import NotAvailable from 'sentry/components/notAvailable';
import Tooltip from 'sentry/components/tooltip';
import {IconChevron, IconDelete, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  FeatureFlagKind,
  FeatureFlagSegment,
  FeatureFlagSegmentTagKind,
} from 'sentry/types/featureFlags';
import {defined} from 'sentry/utils';

import {rateToPercentage} from '../server-side-sampling/utils';

import {getInnerNameLabel} from './modals/segmentModal/utils';
import {getCustomTagLabel, isCustomTag} from './utils';

type Props = {
  canGrab: boolean;
  dragging: boolean;
  flagKind: FeatureFlagKind;
  hasAccess: boolean;
  listeners: DraggableSyntheticListeners;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
  segment: FeatureFlagSegment;
  grabAttributes?: UseDraggableArguments['attributes'];
};

export function Segment({
  onDelete,
  onToggle,
  onEdit,
  hasAccess,
  segment,
  canGrab,
  flagKind,
  listeners,
  grabAttributes,
  dragging,
}: Props) {
  const [expandedPayload, setExpandedPayload] = useState(false);

  return (
    <SegmentsLayout isContent onClick={onEdit}>
      <ActionsColumn>
        <Grabber
          disabled={!hasAccess || !canGrab}
          onClick={e => {
            if (!hasAccess || !canGrab) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <Tooltip
            containerDisplayMode="inline-flex"
            title={
              !canGrab
                ? t('Add more segments to be able to sort')
                : !hasAccess
                ? t("You don't have access to sort segments")
                : undefined
            }
            disabled={canGrab}
          >
            <IconGrabbableWrapper
              {...(canGrab && {...listeners, ...grabAttributes})}
              aria-label={dragging ? t('Drop Segment') : t('Drag Segment')}
              aria-disabled={!hasAccess || !canGrab}
            >
              <IconGrabbable />
            </IconGrabbableWrapper>
          </Tooltip>
        </Grabber>
        <Tooltip
          title={!segment.payload ? t('No payload available') : undefined}
          disabled={!!segment.payload}
          containerDisplayMode="inline-flex"
        >
          <ExpandButton
            aria-label={t('Expand to see payload')}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              if (!!segment.payload) {
                setExpandedPayload(!expandedPayload);
              }
            }}
            disabled={!segment.payload}
            direction={expandedPayload ? 'up' : 'down'}
          />
        </Tooltip>
      </ActionsColumn>
      <TypeColumn>
        <Type>{segment.type === 'match' ? t('Match') : t('Rollout')}</Type>
      </TypeColumn>
      <ConditionColumn>
        {!!Object.keys(segment.tags ?? {}).length ? (
          <Fragment>
            {Object.keys(segment.tags ?? {}).map((tagKey, index) => {
              const tagValue = segment.tags?.[tagKey];
              return (
                <Condition key={index}>
                  <ConditionName>
                    {isCustomTag(tagKey)
                      ? getCustomTagLabel(tagKey)
                      : getInnerNameLabel(tagKey as FeatureFlagSegmentTagKind)}
                  </ConditionName>
                  <ConditionEqualOperator>{'='}</ConditionEqualOperator>
                  {Array.isArray(tagValue) ? (
                    <div>
                      {tagValue.map((conditionValue, conditionValueIndex) => (
                        <Fragment key={conditionValue}>
                          <ConditionValue>{conditionValue}</ConditionValue>
                          {conditionValueIndex !== (tagValue as string[]).length - 1 && (
                            <ConditionSeparator>{'\u002C'}</ConditionSeparator>
                          )}
                        </Fragment>
                      ))}
                    </div>
                  ) : (
                    <ConditionValue>{String(tagValue)}</ConditionValue>
                  )}
                </Condition>
              );
            })}
          </Fragment>
        ) : (
          <NotAvailable />
        )}
      </ConditionColumn>
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
          <StyledContextData data={segment.payload} />
        </Payload>
      )}
    </SegmentsLayout>
  );
}

export const SegmentsLayout = styled('div')<{isContent?: boolean}>`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 96px 66px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 90px 1fr 0.5fr 96px 66px;
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 64px 90px 1fr 0.5fr 96px 66px;
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
  align-items: flex-start;
`;

export const ActionsColumn = styled(Column)`
  display: grid;
  grid-template-columns: max-content max-content;
  gap: ${space(2)};
  padding-right: 0;

  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
  }
`;

export const TypeColumn = styled(Column)`
  text-align: left;
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: flex;
  }
`;

export const ConditionColumn = styled(Column)`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  align-items: flex-start;
  flex-wrap: wrap;
`;

export const RolloutColumn = styled(Column)`
  text-align: center;
  justify-content: center;
`;

export const DeleteColumn = styled(Column)``;

export const ResultColumn = styled(Column)`
  text-align: right;
  justify-content: flex-end;

  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
  }
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
  width: 16px;
  cursor: grabbing;

  ${p =>
    p.disabled &&
    css`
      cursor: not-allowed;
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

const Condition = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space(1)};
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

const ExpandButton = styled(IconChevron)<{disabled: boolean}>`
  height: 28px;
  ${p =>
    p.disabled &&
    css`
      cursor: not-allowed;
      color: ${p.theme.disabled};
    `}
`;

const ConditionEqualOperator = styled('div')`
  color: ${p => p.theme.purple300};
`;

const ConditionName = styled('div')`
  color: ${p => p.theme.gray400};
`;

const ConditionValue = styled('span')`
  color: ${p => p.theme.gray300};
`;

const ConditionSeparator = styled(ConditionValue)`
  padding-right: ${space(0.5)};
`;
