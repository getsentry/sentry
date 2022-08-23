import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import NewBooleanField from 'sentry/components/forms/booleanField';
import {Panel} from 'sentry/components/panels';
import Tag from 'sentry/components/tag';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {FeatureFlag} from 'sentry/types/featureFlags';

import {Evaluations} from './evaluations';

type Props = FeatureFlag & {
  flagKey: string;
  onActivateToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
};

export function Card({
  flagKey,
  enabled,
  evaluations,
  onActivateToggle,
  onEdit,
  onDelete,
  description,
}: Props) {
  const hasEvaluations = evaluations.length > 0;
  const activeResult = evaluations.some(({result}) => result);

  return (
    <Wrapper>
      <Header>
        <div>
          <Key>{flagKey}</Key>
          {description && <Description>{description}</Description>}
        </div>
        {hasEvaluations ? (
          enabled && activeResult ? (
            <Tag type="success">{t('Active')}</Tag>
          ) : (
            <Tag>{t('Inactive')}</Tag>
          )
        ) : enabled ? (
          <Tag type="success">{t('Active')}</Tag>
        ) : (
          <Tag>{t('Inactive')}</Tag>
        )}
        <Actions>
          <ActiveToggle
            inline={false}
            hideControlState
            aria-label={enabled ? t('Disable Flag') : t('Enable Flag')}
            onClick={onActivateToggle}
            name="active"
            value={enabled}
          />
          <Button size="xs" onClick={() => {}}>
            {t('Add Segment')}
          </Button>
          <DropdownMenuControl
            items={[
              {
                key: 'feature-flag-edit',
                label: t('Edit'),
                onAction: onEdit,
              },
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
            ]}
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
      {!!evaluations.length && <Evaluations evaluations={evaluations} />}
    </Wrapper>
  );
}

const Wrapper = styled(Panel)`
  display: grid;
  gap: ${space(2)};
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
  gap: ${space(1.5)};
  justify-content: flex-end;
  align-items: center;
`;
