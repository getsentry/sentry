import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import NewBooleanField from 'sentry/components/forms/booleanField';
import {Panel} from 'sentry/components/panels';
import Tag from 'sentry/components/tagDeprecated';
import Tooltip from 'sentry/components/tooltip';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {FeatureFlag, FeatureFlagSegment} from 'sentry/types/featureFlags';
import theme from 'sentry/utils/theme';
import useMedia from 'sentry/utils/useMedia';

import {DraggableRuleListUpdateItemsProps} from '../server-side-sampling/draggableRuleList';

import {Segments} from './segments';
import {preDefinedFeatureFlags} from './utils';

type Props = Omit<FeatureFlag, 'evaluation' | 'custom'> & {
  flagKey: string;
  hasAccess: boolean;
  onActivateToggle: () => void;
  onAddSegment: () => void;
  onDelete: () => void;
  onDeleteSegment: (index: number) => void;
  onEdit: () => void;
  onEditSegment: (index: number) => void;
  onSortSegments: (props: DraggableRuleListUpdateItemsProps) => void;
  onToggleBooleanSegment: (index: number) => void;
  segments: FeatureFlagSegment[];
};

export function Card({
  flagKey,
  enabled,
  onActivateToggle,
  onEdit,
  onDelete,
  onAddSegment,
  onEditSegment,
  onDeleteSegment,
  description,
  hasAccess,
  segments,
  onSortSegments,
  onToggleBooleanSegment,
  kind,
}: Props) {
  const isSmallDevice = useMedia(`(max-width: ${theme.breakpoints.small})`);

  const actionMenuItems: MenuItemProps[] = [
    {
      key: 'feature-flag-delete',
      label: t('Delete'),
      priority: 'danger',
      onAction: () => {
        openConfirmModal({
          message: t('Are you sure you want to delete this feature flag?'),
          priority: 'danger',
          onConfirm: onDelete,
        });
      },
    },
  ];

  if (!preDefinedFeatureFlags[flagKey]) {
    actionMenuItems.push({
      key: 'feature-flag-edit',
      label: t('Edit'),
      onAction: onEdit,
    });
  }

  if (isSmallDevice) {
    actionMenuItems.push({
      key: 'feature-flag-add-segment',
      label: t('Add Segment'),
      onAction: onAddSegment,
    });
  }

  return (
    <CardPanel hasSegment={!!segments.length}>
      <CardPanelHeader>
        <div>
          <Key>{preDefinedFeatureFlags[flagKey]?.humanReadableName ?? flagKey}</Key>
          {description && <Description>{description}</Description>}
        </div>
        <Actions>
          {preDefinedFeatureFlags[flagKey] && (
            <Tooltip
              title={t('This is an built-in SDK feature flag')}
              position="right"
              containerDisplayMode="inline-flex"
            >
              <Tag priority="info">{'built-in'}</Tag>
            </Tooltip>
          )}
          <ActiveToggle
            inline={false}
            hideControlState
            aria-label={enabled ? t('Disable Flag') : t('Enable Flag')}
            onClick={onActivateToggle}
            name="active"
            value={enabled}
          />
          <AddSegmentButton size="xs" onClick={onAddSegment}>
            {t('Add Segment')}
          </AddSegmentButton>
          <DropdownMenuControl
            items={actionMenuItems}
            trigger={({props: triggerProps, ref: triggerRef}) => (
              <Button
                ref={triggerRef}
                {...triggerProps}
                aria-label={t('Actions')}
                size="xs"
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();

                  triggerProps.onClick?.(e);
                }}
                icon={<IconEllipsis direction="down" size="sm" />}
              />
            )}
            placement="bottom right"
            offset={4}
          />
        </Actions>
      </CardPanelHeader>
      {!!segments.length && (
        <Segments
          segments={segments}
          onDelete={onDeleteSegment}
          onEdit={onEditSegment}
          hasAccess={hasAccess}
          onSort={onSortSegments}
          canGrab={segments.length > 1}
          onToggle={onToggleBooleanSegment}
          flagKind={kind}
        />
      )}
    </CardPanel>
  );
}

const CardPanel = styled(Panel)<{hasSegment: boolean}>`
  ${p =>
    p.hasSegment &&
    css`
      border-bottom: none;
    `}
`;

const CardPanelHeader = styled('div')`
  display: grid;
  padding: ${space(1.5)} ${space(2)};
  align-items: flex-start;
  gap: ${space(1)};
  grid-template-columns: 1fr max-content;

  > * {
    line-height: 24px;
  }
`;

const Key = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  grid-column: 1/-1;
`;

const Actions = styled('div')`
  display: grid;
  gap: ${space(2)};
  justify-content: flex-end;
  align-items: center;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
`;

const ActiveToggle = styled(NewBooleanField)`
  padding: 0;
  height: 24px;
  justify-content: center;
  border-bottom: none;
`;

const AddSegmentButton = styled(Button)`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: block;
  }
`;
