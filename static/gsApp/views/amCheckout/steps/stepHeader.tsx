import {css} from '@emotion/react';
import styled from '@emotion/styled';
import kebabCase from 'lodash/kebabCase';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {IconCheckmark, IconChevron, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import type {PlanTier} from 'getsentry/types';
import LegacyPlanToggle from 'getsentry/views/amCheckout/legacyPlanToggle';
import {getToggleTier} from 'getsentry/views/amCheckout/utils';

type Props = {
  isActive: boolean;
  isCompleted: boolean;
  onEdit: (stepNumber: number) => void;
  stepNumber: number;
  title: string;
  /**
   * Can skip directly to this step
   */
  canSkip?: boolean;
  checkoutTier?: PlanTier;
  onToggleLegacy?: (tier: string) => void;
  organization?: Organization;
  trailingItems?: React.ReactNode;
};

function StepHeader({
  isActive,
  isCompleted,
  stepNumber,
  onEdit,
  title,
  trailingItems,
  canSkip,
  onToggleLegacy,
  checkoutTier,
  organization,
}: Props) {
  const canEdit = !isActive && (isCompleted || canSkip);

  const toggleTier = getToggleTier(checkoutTier);

  return (
    <Header
      isActive={isActive}
      canEdit={canEdit}
      onClick={canEdit ? () => onEdit(stepNumber) : undefined}
      data-test-id={`header-${kebabCase(title)}`}
    >
      <Flex justify="space-between">
        <StepTitle>
          {isCompleted ? (
            <IconCheckmark isCircled color="green300" />
          ) : (
            <div>{`${stepNumber}.`}</div>
          )}
          {title}
        </StepTitle>
        {trailingItems && <div>{trailingItems}</div>}
      </Flex>
      <div>
        {isActive && toggleTier ? (
          typeof onToggleLegacy === 'function' && (
            <LegacyPlanToggle
              organization={organization}
              checkoutTier={checkoutTier}
              onClick={() => onToggleLegacy(toggleTier)}
              data-test-id="legacy-tier-toggle"
            />
          )
        ) : (
          <EditStep>
            {isCompleted && (
              <Button size="sm" onClick={() => onEdit(stepNumber)} icon={<IconEdit />}>
                {t('Edit')}
              </Button>
            )}
            {canEdit && (
              <Button
                size="sm"
                aria-label={t('Expand section')}
                icon={<IconChevron direction="down" />}
              />
            )}
          </EditStep>
        )}
      </div>
    </Header>
  );
}

export default StepHeader;

const Header = styled('div')<{canEdit?: boolean; isActive?: boolean}>`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(1)};
  align-items: center;
  padding: ${space(3)} ${space(2)};
  cursor: ${p => (p.canEdit ? 'pointer' : undefined)};

  ${p =>
    p.isActive &&
    css`
      border-bottom: 1px solid ${p.theme.border};
    `};
`;

const StepTitle = styled('div')`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSize.lg};
  color: ${p => p.theme.subText};
`;

const EditStep = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
`;
