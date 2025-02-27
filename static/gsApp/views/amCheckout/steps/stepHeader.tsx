import {css} from '@emotion/react';
import styled from '@emotion/styled';
import kebabCase from 'lodash/kebabCase';

import {IconCheckmark, IconChevron} from 'sentry/icons';
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
      onClick={() => canEdit && onEdit(stepNumber)}
      data-test-id={`header-${kebabCase(title)}`}
    >
      <StepTitleWrapper>
        <StepTitle>
          {isCompleted ? (
            <IconCheckmark isCircled color="green300" />
          ) : (
            <div>{`${stepNumber}.`}</div>
          )}
          {title}
        </StepTitle>
        {trailingItems && <div>{trailingItems}</div>}
      </StepTitleWrapper>
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
            {isCompleted && <a onClick={() => onEdit(stepNumber)}>{t('Edit')}</a>}
            {canEdit && <Chevron direction="down" aria-label={t('Expand section')} />}
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

  ${p =>
    p.isActive &&
    css`
      border-bottom: 1px solid ${p.theme.border};
    `};

  ${p =>
    p.canEdit &&
    css`
      cursor: pointer;
    `};
`;

const StepTitle = styled('div')`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.subText};
`;

const EditStep = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
`;

const Chevron = styled(IconChevron)`
  color: ${p => p.theme.border};
  justify-self: end;
`;

const StepTitleWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
`;
