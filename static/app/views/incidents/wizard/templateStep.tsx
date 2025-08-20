import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button/';
import {t} from 'sentry/locale';

interface TemplateStepProps {
  onComplete: (stepId: string) => void;
}

export function TemplateStep({onComplete}: TemplateStepProps) {
  return (
    <StepContent>
      <h3>{t('Setup a Template')}</h3>
      <p>
        {t(
          'Create incident response templates that automatically trigger the right tools and assign the right people when incidents occur.'
        )}
      </p>

      <TemplateForm>
        <FormGroup>
          <label>{t('Template Name')}</label>
          <input placeholder={t('e.g., Critical API Outage')} />
        </FormGroup>
        <FormGroup>
          <label>{t('Severity Levels')}</label>
          <SeverityLevels>
            <SeverityBadge>P1</SeverityBadge>
            <SeverityBadge>P2</SeverityBadge>
            <SeverityBadge>P3</SeverityBadge>
          </SeverityLevels>
        </FormGroup>
        <FormGroup>
          <label>{t('Auto-assign to')}</label>
          <input placeholder={t('e.g., @oncall-team')} />
        </FormGroup>
      </TemplateForm>

      <Button priority="primary" onClick={() => onComplete('template')}>
        {t('Save Template')}
      </Button>
    </StepContent>
  );
}

const StepContent = styled('div')`
  max-width: 600px;
`;

const TemplateForm = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const FormGroup = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-weight: 600;
    font-size: 0.875rem;
    color: ${p => p.theme.textColor};
  }

  input {
    padding: 0.5rem;
    border: 1px solid ${p => p.theme.border};
    border-radius: ${p => p.theme.borderRadius};
    font-size: 0.875rem;
  }
`;

const SeverityLevels = styled('div')`
  display: flex;
  gap: 0.5rem;
`;

const SeverityBadge = styled('span')`
  padding: 0.25rem 0.5rem;
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: ${p => p.theme.background};
  }
`;
