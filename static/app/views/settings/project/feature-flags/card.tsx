import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import NewBooleanField from 'sentry/components/forms/booleanField';
import {Panel} from 'sentry/components/panels';
import Tag from 'sentry/components/tag';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {Evaluation, Evaluations} from './evaluations';

type Props = {
  enabled: boolean;
  evaluations: Evaluation[];
  name: string;
  onEnable: () => void;
  description?: string;
};

export function Card({name, enabled, evaluations, onEnable, description}: Props) {
  const activeResult = evaluations.some(({result}) => result);
  return (
    <Wrapper>
      <Header>
        <div>
          <Name>{startCase(name)}</Name>
          {description && <Description>{description}</Description>}
        </div>
        {enabled && activeResult ? (
          <Tag type="success">{t('Active')}</Tag>
        ) : (
          <Tag>{t('Inactive')}</Tag>
        )}
        <Actions>
          <ActiveToggle
            inline={false}
            hideControlState
            aria-label={enabled ? t('Disable Flag') : t('Enable Flag')}
            onClick={onEnable}
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
                onAction: () => {},
              },
              {
                key: 'feature-flag-delete',
                label: t('Delete'),
                priority: 'danger',
                onAction: () => {
                  openConfirmModal({
                    message: t('Are you sure you want to delete this feature flag?'),
                    priority: 'danger',
                    onConfirm: () => {},
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
      <Content>
        {!!evaluations.length && <Evaluations evaluations={evaluations} />}
      </Content>
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
    line-height: 24px;
  }
`;

const Content = styled('div')`
  display: grid;
`;

const Name = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
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
`;
