import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import NewBooleanField from 'sentry/components/forms/booleanField';
import {Panel} from 'sentry/components/panels';
import Tag from 'sentry/components/tag';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {FeatureFlag, FeatureFlagSegment} from 'sentry/types/featureFlags';

import {DraggableRuleListUpdateItemsProps} from '../server-side-sampling/draggableRuleList';

import {preDefinedFeatureFlags} from './modals/flagModal/utils';
import {Segments} from './segments';

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
}: Props) {
  return (
    <Wrapper hasSegment={!!segments.length}>
      <Header>
        <div>
          <Key>{preDefinedFeatureFlags[flagKey]?.humanReadableName ?? flagKey}</Key>
          {description && <Description>{description}</Description>}
        </div>
        {enabled ? <Tag type="success">{t('Active')}</Tag> : <Tag>{t('Inactive')}</Tag>}
        <Actions>
          <ActiveToggle
            inline={false}
            hideControlState
            aria-label={enabled ? t('Disable Flag') : t('Enable Flag')}
            onClick={onActivateToggle}
            name="active"
            value={enabled}
          />
          <Button size="xs" onClick={onAddSegment}>
            {t('Add Segment')}
          </Button>
          <DropdownMenuControl
            items={
              [
                ...(!preDefinedFeatureFlags[flagKey]
                  ? [
                      {
                        key: 'feature-flag-edit',
                        label: t('Edit'),
                        onAction: onEdit,
                      },
                    ]
                  : []),
                ...[
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
                ],
              ] as MenuItemProps[]
            }
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
      </Header>
      {!!segments.length && (
        <Segments
          segments={segments}
          onDeleteSegment={onDeleteSegment}
          onEditSegment={onEditSegment}
          hasAccess={hasAccess}
          onSort={onSortSegments}
          showGrab={segments.length > 1}
          onToggleBooleanSegment={onToggleBooleanSegment}
        />
      )}
    </Wrapper>
  );
}

const Wrapper = styled(Panel)<{hasSegment: boolean}>`
  display: grid;
  gap: ${space(2)};
  ${p =>
    p.hasSegment &&
    css`
      border-bottom: none;
    `}
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content 1fr;
  padding: ${space(1.5)} ${space(2)};
  gap: ${space(1)};
  > * {
    line-height: 28px;
  }
`;

const Key = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  line-height: 1;
`;

const ActiveToggle = styled(NewBooleanField)`
  padding: 0;
  height: 24px;
  justify-content: center;
  border-bottom: none;
`;

const Actions = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content max-content;
  gap: ${space(2)};
  justify-content: flex-end;
  align-items: center;
`;
