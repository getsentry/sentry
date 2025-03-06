import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {hasLaravelInsightsFeature} from 'sentry/views/insights/pages/backend/laravel/features';
import {useLaravelInsightsContext} from 'sentry/views/insights/pages/backend/laravel/laravelInsightsContext';

export function NewLaravelExperienceButton() {
  const organization = useOrganization();
  const hasLaravelInsightsFlag = hasLaravelInsightsFeature(organization);
  const {isLaravelInsightsEnabled, setIsLaravelInsightsEnabled} =
    useLaravelInsightsContext();

  const openForm = useFeedbackForm();

  const handleToggle = useCallback(() => {
    setIsLaravelInsightsEnabled(!isLaravelInsightsEnabled);
    trackAnalytics('laravel-insights.ui_toggle', {
      isEnabled: !isLaravelInsightsEnabled,
      organization,
    });
  }, [setIsLaravelInsightsEnabled, isLaravelInsightsEnabled, organization]);

  if (!hasLaravelInsightsFlag) {
    return null;
  }

  if (!openForm || !isLaravelInsightsEnabled) {
    const label = isLaravelInsightsEnabled
      ? t('Switch to the old experience')
      : t('Switch to the new experience');
    const text = isLaravelInsightsEnabled ? null : t('Try New UI');

    return (
      <ToggleButton
        enabled={isLaravelInsightsEnabled}
        size="sm"
        icon={<IconLab isSolid={isLaravelInsightsEnabled} />}
        title={label}
        aria-label={label}
        onClick={handleToggle}
      >
        {text}
      </ToggleButton>
    );
  }

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <StyledDropdownButton
          {...triggerProps}
          enabled={isLaravelInsightsEnabled}
          size="sm"
          aria-label={t('Switch issue experience')}
        >
          {/* Passing icon as child to avoid extra icon margin */}
          <IconLab isSolid={isLaravelInsightsEnabled} />
        </StyledDropdownButton>
      )}
      items={[
        {
          key: 'switch-to-old-ui',
          label: t('Switch to the old experience'),
          onAction: handleToggle,
        },
        {
          key: 'give-feedback',
          label: t('Give feedback on new UI'),
          hidden: !openForm,
          onAction: () => {
            openForm({
              messagePlaceholder: t(
                'Excluding bribes, what would make you excited to use the new UI?'
              ),
              tags: {
                ['feedback.source']: 'laravel-insights',
                ['feedback.owner']: 'telemetry-experience',
              },
            });
          },
        },
      ]}
      position="bottom-end"
    />
  );
}

const StyledDropdownButton = styled(DropdownButton)<{enabled: boolean}>`
  color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  :hover {
    color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  }
`;

const ToggleButton = styled(Button)<{enabled: boolean}>`
  color: ${p => (p.enabled ? p.theme.button.primary.background : p.theme.white)};
  background: ${p =>
    p.enabled ? 'inherit' : `linear-gradient(90deg, #3468D8, #248574)`};
  :hover {
    color: ${p => (p.enabled ? p.theme.button.primary.background : p.theme.white)};
  }
`;
